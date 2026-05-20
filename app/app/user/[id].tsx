import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FeedActivityCard } from '@/components/feed-activity-card';
import { FeedCard } from '@/components/feed-card';
import { FeedCommentsSheet } from '@/components/feed-comments-sheet';
import { MutualFriendsModal } from '@/components/mutual-friends-modal';
import { MutualFriendsRow } from '@/components/mutual-friends-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UserHabitChips } from '@/components/user-habit-chips';
import { UserHero } from '@/components/user-hero';
import { useAuth } from '@/lib/auth';
import {
  applyLikeToggle, blockUser, likeActivity, likeCompletion,
  muteHabit, reportContent, unlikeActivity, unlikeCompletion,
  type FeedItem, type FeedKind,
} from '@/lib/feed';
import type { FriendProfile } from '@/lib/friends';
import {
  fetchMutualFriends, fetchUserFeedPage, fetchUserHabits, fetchUserProfile,
  filterItemsByLineage, mergeUserFeedPages, userFeedSortKey,
  type UserHabit, type UserProfileData,
} from '@/lib/user-profile';

const PAGE_SIZE = 20;

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const viewerId = session?.user.id ?? '';
  const now = useRef(new Date()).current;
  const allItemsRef = useRef<FeedItem[]>([]);
  const reachedEndAllRef = useRef(false);

  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [habits, setHabits] = useState<UserHabit[]>([]);
  const [mutualFriends, setMutualFriends] = useState<FriendProfile[]>([]);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paging, setPaging] = useState(false);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [selectedLineageId, setSelectedLineageId] = useState<string | null>(null);
  const [activeComment, setActiveComment] = useState<{ targetId: string; targetKind: FeedKind; ownerId: string } | null>(null);
  const [mutualModalOpen, setMutualModalOpen] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [p, h] = await Promise.all([
        fetchUserProfile(id, viewerId),
        fetchUserHabits(id, viewerId),
      ]);
      setProfile(p); setHabits(h);
      const [feed, mf] = await Promise.all([
        fetchUserFeedPage(id, undefined, PAGE_SIZE),
        id !== viewerId ? fetchMutualFriends(viewerId, id) : Promise.resolve([]),
      ]);
      allItemsRef.current = feed;
      reachedEndAllRef.current = feed.length < PAGE_SIZE;
      setItems(feed); setMutualFriends(mf); setSelectedLineageId(null);
      setReachedEnd(feed.length < PAGE_SIZE);
    } finally { setLoading(false); }
  }, [id, viewerId]);

  useFocusEffect(useCallback(() => { loadAll(); }, [loadAll]));

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try { await loadAll(); } finally { setRefreshing(false); }
  }, [loadAll]);

  const loadMore = useCallback(async () => {
    if (paging || reachedEnd || items.length === 0) return;
    const last = items[items.length - 1];
    setPaging(true);
    try {
      const next = await fetchUserFeedPage(
        id, { sort_key: userFeedSortKey(last), id: last.id },
        PAGE_SIZE, selectedLineageId ?? undefined,
      );
      setItems((prev) => mergeUserFeedPages(prev, next));
      allItemsRef.current = mergeUserFeedPages(allItemsRef.current, next);
      if (next.length < PAGE_SIZE) {
        setReachedEnd(true);
        if (!selectedLineageId) reachedEndAllRef.current = true;
      }
    } finally { setPaging(false); }
  }, [id, items, paging, reachedEnd, selectedLineageId]);

  const handleChipSelect = useCallback((lineageId: string | null) => {
    setSelectedLineageId(lineageId);
    if (lineageId === null) {
      setItems(allItemsRef.current);
      setReachedEnd(reachedEndAllRef.current);
    } else {
      setItems(filterItemsByLineage(allItemsRef.current, habits, lineageId));
      setReachedEnd(false);
    }
  }, [habits]);

  const handleToggleLike = useCallback(async (item: FeedItem) => {
    if (!viewerId) return;
    const next = !item.viewer_liked;
    setItems((p) => p.map((i) => (i.id === item.id ? applyLikeToggle(i, next) : i)));
    try {
      if (next) await (item.feed_kind === 'completion' ? likeCompletion : likeActivity)(item.id, viewerId);
      else await (item.feed_kind === 'completion' ? unlikeCompletion : unlikeActivity)(item.id, viewerId);
    } catch {
      setItems((p) => p.map((i) => (i.id === item.id ? applyLikeToggle(i, !next) : i)));
    }
  }, [viewerId]);

  if (!profile && !loading) return (
    <ThemedView style={s.root}><SafeAreaView edges={['top']} style={s.center}>
      <ThemedText style={s.muted}>User not found</ThemedText>
    </SafeAreaView></ThemedView>
  );

  const cardProps = (item: FeedItem) => ({
    item, viewerId, now,
    onToggleLike: () => handleToggleLike(item),
    onOpenComments: () => setActiveComment({ targetId: item.id, targetKind: item.feed_kind, ownerId: item.owner_id }),
    onReport: () => reportContent(viewerId, { kind: 'completion', id: item.id }),
    onBlock: () => blockUser(viewerId, item.owner_id).then(() => router.back()),
    onMute: () => muteHabit(viewerId, item.habit_id).then(loadAll),
  });

  return (
    <ThemedView style={s.root}>
      <SafeAreaView edges={['top']} style={s.safe}>
        {loading && !profile ? (
          <View style={s.center}><ActivityIndicator /></View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(i) => i.id}
            ListHeaderComponent={
              <View>
                {profile && (
                  <>
                    <UserHero profile={profile} viewerId={viewerId} targetId={id} onReload={loadAll} onBack={() => router.back()} />
                    {profile.friendship_status !== 'self' && (
                      <MutualFriendsRow friends={mutualFriends} totalCount={profile.mutual_friend_count} onPress={() => setMutualModalOpen(true)} />
                    )}
                  </>
                )}
                <View style={s.chipsWrap}>
                  <UserHabitChips habits={habits} selectedLineageId={selectedLineageId} onSelect={handleChipSelect} />
                </View>
              </View>
            }
            renderItem={({ item }) =>
              item.feed_kind === 'habit_created'
                ? <FeedActivityCard {...cardProps(item)} />
                : <FeedCard {...cardProps(item)} onEdit={item.owner_id === viewerId ? () => router.push(`/completion/${item.id}`) : undefined} />
            }
            ItemSeparatorComponent={Sep}
            ListEmptyComponent={loading ? <View style={s.footer}><ActivityIndicator /></View> : <ThemedText style={s.empty}>No activity yet</ThemedText>}
            ListFooterComponent={paging ? <View style={s.footer}><ActivityIndicator /></View> : null}
            onEndReached={loadMore}
            onEndReachedThreshold={0.4}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          />
        )}
        <FeedCommentsSheet
          visible={activeComment !== null}
          targetId={activeComment?.targetId ?? null}
          targetKind={activeComment?.targetKind ?? 'completion'}
          targetOwnerId={activeComment?.ownerId ?? null}
          onClose={() => setActiveComment(null)}
          onCountChange={(delta) => {
            if (!activeComment) return;
            setItems((p) => p.map((i) => i.id === activeComment.targetId ? { ...i, comment_count: Math.max(0, i.comment_count + delta) } : i));
          }}
        />
        <MutualFriendsModal visible={mutualModalOpen} userA={viewerId} userB={id} onClose={() => setMutualModalOpen(false)} />
      </SafeAreaView>
    </ThemedView>
  );
}

function Sep() { return <View style={s.sep} />; }

const s = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { opacity: 0.6, fontSize: 15 },
  chipsWrap: { paddingBottom: 12 },
  empty: { textAlign: 'center', opacity: 0.5, paddingTop: 40, fontSize: 15 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(127,127,127,0.25)', marginHorizontal: 14 },
  footer: { paddingVertical: 18, alignItems: 'center' },
});
