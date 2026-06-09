import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { ActivityHeatmap } from '@/components/activity-heatmap';
import { formatDaySummary } from '@/lib/activity-heatmap';
import { FeedActivityCard } from '@/components/feed-activity-card';
import { FeedCard } from '@/components/feed-card';
import { FeedCommentsSheet } from '@/components/feed-comments-sheet';
import { MutualFriendsModal } from '@/components/mutual-friends-modal';
import { MutualFriendsRow } from '@/components/mutual-friends-row';
import { ThemedText } from '@/components/themed-text';
import { UserHabitChips } from '@/components/user-habit-chips';
import { UserHero } from '@/components/user-hero';
import { applyLikeToggle, blockUser, likeActivity, likeCompletion, muteHabit, reportContent, unlikeActivity, unlikeCompletion, type FeedItem, type FeedKind } from '@/lib/feed';
import type { FriendProfile } from '@/lib/friends';
import { fetchMutualFriends, fetchUserFeedPage, fetchUserHabits, fetchUserProfile, filterItemsByDate, filterItemsByLineage, habitsCompletedOnDate, mergeUserFeedPages, userFeedSortKey, type UserHabit, type UserProfileData } from '@/lib/user-profile';

const PAGE_SIZE = 20;

type Props = {
  targetId: string;
  viewerId: string;
  onBack?: () => void;
};

export function UserProfileView({ targetId, viewerId, onBack }: Props) {
  const router = useRouter();
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
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedDayCount, setSelectedDayCount] = useState(0);
  const [mutualModalOpen, setMutualModalOpen] = useState(false);
  const [activeComment, setActiveComment] = useState<{ targetId: string; targetKind: FeedKind; ownerId: string } | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [p, h] = await Promise.all([
        fetchUserProfile(targetId, viewerId),
        fetchUserHabits(targetId, viewerId),
      ]);
      setProfile(p); setHabits(h);
      const [feed, mf] = await Promise.all([
        fetchUserFeedPage(targetId, undefined, PAGE_SIZE),
        targetId !== viewerId ? fetchMutualFriends(viewerId, targetId) : Promise.resolve([]),
      ]);
      allItemsRef.current = feed;
      reachedEndAllRef.current = feed.length < PAGE_SIZE;
      setItems(feed); setMutualFriends(mf); setSelectedLineageId(null);
      setReachedEnd(feed.length < PAGE_SIZE);
    } finally { setLoading(false); }
  }, [targetId, viewerId]);
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
        targetId, { sort_key: userFeedSortKey(last), id: last.id },
        PAGE_SIZE, selectedLineageId ?? undefined,
      );
      setItems((prev) => mergeUserFeedPages(prev, next));
      allItemsRef.current = mergeUserFeedPages(allItemsRef.current, next);
      if (next.length < PAGE_SIZE) {
        setReachedEnd(true);
        if (!selectedLineageId) reachedEndAllRef.current = true;
      }
    } finally { setPaging(false); }
  }, [targetId, items, paging, reachedEnd, selectedLineageId]);
  const handleDateSelect = useCallback((date: string | null, count: number) => {
    setSelectedDate(date); setSelectedDayCount(count); setSelectedLineageId(null);
    setItems(allItemsRef.current); setReachedEnd(reachedEndAllRef.current);
  }, []);
  const handleChipSelect = useCallback((lineageId: string | null) => {
    setSelectedLineageId(lineageId);
    if (selectedDate) return;
    const filtered = lineageId ? filterItemsByLineage(allItemsRef.current, habits, lineageId) : allItemsRef.current;
    setItems(filtered);
    setReachedEnd(lineageId ? false : reachedEndAllRef.current);
  }, [habits, selectedDate]);
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

  const backHandler = onBack ?? (() => {});

  const visibleHabits = selectedDate ? habitsCompletedOnDate(items, habits, selectedDate) : habits;
  const displayedItems = useMemo(() => {
    const byLineage = selectedLineageId ? filterItemsByLineage(items, habits, selectedLineageId) : items;
    return filterItemsByDate(byLineage, selectedDate);
  }, [items, selectedDate, selectedLineageId, habits]);

  if (!profile && !loading) return <View style={s.center}><ThemedText style={s.muted}>User not found</ThemedText></View>;

  const cardProps = (item: FeedItem) => ({
    item, viewerId, now,
    onToggleLike: () => handleToggleLike(item),
    onOpenComments: () => setActiveComment({ targetId: item.id, targetKind: item.feed_kind, ownerId: item.owner_id }),
    onHabitPress: () => router.push({
      pathname: '/habit/view',
      params: {
        id: item.habit_id,
        ...(item.occurrence_date
          ? { occurrenceDate: item.occurrence_date }
          : item.period_start
            ? { occurrenceDate: item.period_start }
            : {}),
      },
    }),
    onReport: () => reportContent(viewerId, { kind: 'completion', id: item.id }),
    onBlock: () => blockUser(viewerId, item.owner_id).then(backHandler),
    onMute: () => muteHabit(viewerId, item.habit_id).then(loadAll),
  });

  return (
    <>
      {loading && !profile ? (
        <View style={s.center}><ActivityIndicator /></View>
      ) : (
        <FlatList
          data={displayedItems}
          keyExtractor={(i) => i.id}
          ListHeaderComponent={
            <View>
              {profile && (
                <>
                  <UserHero profile={profile} viewerId={viewerId} targetId={targetId} onReload={loadAll} onBack={backHandler} />
                  {profile.friendship_status !== 'self' && (
                    <MutualFriendsRow friends={mutualFriends} totalCount={profile.mutual_friend_count} onPress={() => setMutualModalOpen(true)} />
                  )}
                </>
              )}
              <ActivityHeatmap
                targetId={targetId} viewerId={viewerId}
                selectedLineageId={selectedLineageId} selectedDate={selectedDate}
                onSelectDate={handleDateSelect} habits={habits}
              />
              {selectedDate != null && (
                <ThemedText style={s.daySummary}>{formatDaySummary(selectedDate, selectedDayCount)}</ThemedText>
              )}
              <View style={s.chipsWrap}>
                <UserHabitChips habits={visibleHabits} selectedLineageId={selectedLineageId} onSelect={handleChipSelect} />
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
      <MutualFriendsModal visible={mutualModalOpen} userA={viewerId} userB={targetId} onClose={() => setMutualModalOpen(false)} />
    </>
  );
}

function Sep() { return <View style={s.sep} />; }

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { opacity: 0.6, fontSize: 15 },
  daySummary: { paddingHorizontal: 14, paddingBottom: 4, fontSize: 13, opacity: 0.7 },
  chipsWrap: { paddingBottom: 12 },
  empty: { textAlign: 'center', opacity: 0.5, paddingTop: 40, fontSize: 15 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(127,127,127,0.25)', marginHorizontal: 14 },
  footer: { paddingVertical: 18, alignItems: 'center' },
});
