// Feed tab — reverse-chronological stream of the viewer's own + friends'
// visible completions. See /FEED_PLAN.md for the architectural details.

import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Palette } from "@/constants/colors";
import { useDrawer } from "@/components/drawer-provider";
import { FeedCommentsSheet } from "@/components/feed-comments-sheet";
import { FeedEmpty } from "@/components/feed-empty";
import { FeedNewPill } from "@/components/feed-new-pill";
import { FeedRow } from "@/components/feed-row";
import { ScreenHeader } from "@/components/screen-header";
import { TabTopBar } from "@/components/tab-top-bar";
import { ThemedView } from "@/components/themed-view";
import { useAuth } from "@/lib/auth";
import {
  applyLikeToggle,
  blockUser,
  feedItemSortKey,
  fetchFeedPage,
  likeActivity,
  likeCompletion,
  mergeFeedPages,
  muteHabit,
  reportContent,
  subscribeToFeed,
  unlikeActivity,
  unlikeCompletion,
  type FeedItem,
  type FeedKind,
} from "@/lib/feed";

const PAGE_SIZE = 20;

export default function FeedScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const { openDrawer } = useDrawer();
  const viewerId = session?.user.id ?? null;
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [paging, setPaging] = useState(false);
  const [pendingNew, setPendingNew] = useState(0);
  const [activeCommentTarget, setActiveCommentTarget] = useState<{
    targetId: string;
    targetKind: FeedKind;
    ownerId: string;
  } | null>(null);
  const listRef = useRef<FlatList<FeedItem>>(null);
  const isAtTopRef = useRef(true);
  const now = useRef(new Date()).current;

  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    try {
      const page = await fetchFeedPage(undefined, PAGE_SIZE);
      setItems(page);
      setReachedEnd(page.length < PAGE_SIZE);
      setPendingNew(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!viewerId) return;
      loadFirstPage();
      const unsub = subscribeToFeed({
        onCompletion: (event, id) => {
          if (event === "INSERT") {
            if (isAtTopRef.current) {
              loadFirstPage();
            } else {
              setPendingNew((n) => n + 1);
            }
          } else if (event === "DELETE") {
            setItems((prev) => prev.filter((i) => i.id !== id));
          }
        },
        onActivity: (event) => {
          if (event === "INSERT") {
            if (isAtTopRef.current) {
              loadFirstPage();
            } else {
              setPendingNew((n) => n + 1);
            }
          }
        },
        onLike: (event, completionId) => {
          setItems((prev) =>
            prev.map((i) =>
              i.id === completionId
                ? applyLikeToggle(i, event === "INSERT" ? true : i.viewer_liked)
                : i,
            ),
          );
          // The above keeps viewer_liked sticky; refetch the page for count
          // accuracy on the next pull-to-refresh.
        },
        onComment: (event, completionId) => {
          setItems((prev) =>
            prev.map((i) =>
              i.id === completionId
                ? {
                    ...i,
                    comment_count:
                      event === "INSERT"
                        ? i.comment_count + 1
                        : event === "DELETE"
                          ? Math.max(0, i.comment_count - 1)
                          : i.comment_count,
                  }
                : i,
            ),
          );
        },
        onCommentLike: () => {
          // Card-level state doesn't include comment-like aggregates.
        },
      });
      return unsub;
    }, [viewerId, loadFirstPage]),
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadFirstPage();
    } finally {
      setRefreshing(false);
    }
  }, [loadFirstPage]);

  const loadMore = useCallback(async () => {
    if (paging || reachedEnd || items.length === 0) return;
    const last = items[items.length - 1];
    setPaging(true);
    try {
      const next = await fetchFeedPage(
        { sort_key: feedItemSortKey(last), id: last.id },
        PAGE_SIZE,
      );
      setItems((prev) => mergeFeedPages(prev, next));
      if (next.length < PAGE_SIZE) setReachedEnd(true);
    } finally {
      setPaging(false);
    }
  }, [items, paging, reachedEnd]);

  const handleToggleLike = useCallback(
    async (item: FeedItem) => {
      if (!viewerId) return;
      const next = !item.viewer_liked;
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? applyLikeToggle(i, next) : i)),
      );
      try {
        const like =
          item.feed_kind === "completion" ? likeCompletion : likeActivity;
        const unlike =
          item.feed_kind === "completion" ? unlikeCompletion : unlikeActivity;
        if (next) await like(item.id, viewerId);
        else await unlike(item.id, viewerId);
      } catch {
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? applyLikeToggle(i, !next) : i)),
        );
      }
    },
    [viewerId],
  );

  // Stable per-screen handlers. Each takes the item so the closures can live up
  // here (referentially stable) instead of being rebuilt per row on every
  // render — that's what lets the memoized FeedRow skip re-rendering.
  const openComments = useCallback((item: FeedItem) => {
    setActiveCommentTarget({
      targetId: item.id,
      targetKind:
        item.feed_kind === "habit_created" ? "habit_created" : "completion",
      ownerId: item.owner_id,
    });
  }, []);

  const openEdit = useCallback(
    (item: FeedItem) => router.push(`/completion/${item.id}`),
    [router],
  );

  const openHabit = useCallback(
    (item: FeedItem) => {
      if (item.feed_kind === "habit_created") {
        router.push({
          pathname: "/habit/view",
          params: { id: item.habit_id, activityId: item.id },
        });
        return;
      }
      router.push({
        pathname: "/habit/view",
        params: {
          id: item.habit_id,
          completionId: item.id,
          ...(item.occurrence_date
            ? { occurrenceDate: item.occurrence_date }
            : item.period_start
              ? { occurrenceDate: item.period_start }
              : {}),
        },
      });
    },
    [router],
  );

  const report = useCallback(
    (item: FeedItem) => {
      if (!viewerId) return;
      reportContent(viewerId, { kind: "completion", id: item.id });
    },
    [viewerId],
  );

  const block = useCallback(
    (item: FeedItem) => {
      if (!viewerId) return;
      blockUser(viewerId, item.owner_id).then(loadFirstPage);
    },
    [viewerId, loadFirstPage],
  );

  const mute = useCallback(
    (item: FeedItem) => {
      if (!viewerId) return;
      muteHabit(viewerId, item.habit_id).then(loadFirstPage);
    },
    [viewerId, loadFirstPage],
  );

  const renderItem = useCallback(
    ({ item }: { item: FeedItem }) => {
      if (!viewerId) return null;
      return (
        <FeedRow
          item={item}
          viewerId={viewerId}
          now={now}
          onToggleLike={handleToggleLike}
          onOpenComments={openComments}
          onEditCompletion={openEdit}
          onHabitPress={openHabit}
          onReport={report}
          onBlock={block}
          onMute={mute}
        />
      );
    },
    [
      viewerId,
      now,
      handleToggleLike,
      openComments,
      openEdit,
      openHabit,
      report,
      block,
      mute,
    ],
  );

  const handleScrollToTop = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    loadFirstPage();
  }, [loadFirstPage]);

  if (!viewerId) {
    return (
      <ThemedView style={styles.root}>
        <SafeAreaView edges={[]} style={styles.content}>
          <ScreenHeader>
            <TabTopBar title="Feed" onMenuPress={openDrawer} />
          </ScreenHeader>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const showEmpty = !loading && items.length === 0;

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={[]} style={styles.safe}>
        <ScreenHeader>
          <TabTopBar title="Feed" onMenuPress={openDrawer} />
        </ScreenHeader>

        {loading && items.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        ) : showEmpty ? (
          <FeedEmpty />
        ) : (
          <FlatList
            ref={listRef}
            data={items}
            keyExtractor={(i) => i.id}
            renderItem={renderItem}
            ItemSeparatorComponent={Separator}
            // Stories rail hook: an empty header today, slotted with a
            // <FeedStoriesRail /> in the follow-up plan.
            ListHeaderComponent={null}
            ListFooterComponent={
              paging ? (
                <View style={styles.footer}>
                  <ActivityIndicator />
                </View>
              ) : null
            }
            onScroll={(e) => {
              isAtTopRef.current = e.nativeEvent.contentOffset.y < 60;
            }}
            scrollEventThrottle={120}
            onEndReached={loadMore}
            onEndReachedThreshold={0.4}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={refresh} />
            }
          />
        )}

        <FeedNewPill count={pendingNew} onPress={handleScrollToTop} />

        <FeedCommentsSheet
          visible={activeCommentTarget !== null}
          targetId={activeCommentTarget?.targetId ?? null}
          targetKind={activeCommentTarget?.targetKind ?? "completion"}
          targetOwnerId={activeCommentTarget?.ownerId ?? null}
          onClose={() => setActiveCommentTarget(null)}
          onCountChange={(delta) => {
            if (!activeCommentTarget) return;
            setItems((prev) =>
              prev.map((i) =>
                i.id === activeCommentTarget.targetId
                  ? {
                      ...i,
                      comment_count: Math.max(0, i.comment_count + delta),
                    }
                  : i,
              ),
            );
          }}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  separator: {
    height: 2,
    backgroundColor: Palette.primary,
    marginHorizontal: 0,
  },
  footer: { paddingVertical: 18, alignItems: "center" },
});
