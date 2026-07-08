import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { ActivityHeatmap } from '@/components/activity-heatmap';
import { formatDaySummary } from '@/lib/activity-heatmap';
import { FeedActivityCard } from '@/components/feed-activity-card';
import { FeedCard } from '@/components/feed-card';
import { FeedCommentsSheet } from '@/components/feed-comments-sheet';
import { MutualFriendsModal } from '@/components/mutual-friends-modal';
import { MutualFriendsRow } from '@/components/mutual-friends-row';
import { ProfileDayAgenda } from '@/components/profile-day-agenda';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { UserHero } from '@/components/user-hero';
import { useTokens } from '@/hooks/use-tokens';
import { applyLikeToggle, blockUser, muteHabit, reportContent, type FeedItem, type FeedKind } from '@/lib/feed';
import { socialFnsFor } from '@/lib/feed-dispatch';
import type { FriendProfile } from '@/lib/friends';
import { isoDate } from '@/lib/habits';
import { buildDayGroups, nDayRange, type DayGroup } from '@/lib/history';
import { fetchMutualFriends, fetchUserDayData, fetchUserFeedPage, fetchUserHabits, fetchUserProfile, filterItemsByDate, filterItemsByLineage, mergeUserFeedPages, userFeedSortKey, userHabitsToHabits, type UserHabit, type UserProfileData } from '@/lib/user-profile';

type ProfileTab = 'day' | 'activity';
const TAB_OPTIONS: { value: ProfileTab; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'activity', label: 'Activity' },
];

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
  const [tab, setTab] = useState<ProfileTab>('day');
  const [dayGroups, setDayGroups] = useState<Map<string, DayGroup>>(new Map());
  const [dayLoading, setDayLoading] = useState(false);
  const dayWindow = useRef<{ from: string; to: string } | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    dayWindow.current = null; // force the day-view window to refetch
    try {
      const [p, h] = await Promise.all([
        fetchUserProfile(targetId),
        fetchUserHabits(targetId),
      ]);
      setProfile(p); setHabits(h);
      const [feed, mf] = await Promise.all([
        fetchUserFeedPage(targetId, undefined, PAGE_SIZE),
        targetId !== viewerId ? fetchMutualFriends(targetId) : Promise.resolve([]),
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
  const handleToggleLike = useCallback(async (item: FeedItem) => {
    if (!viewerId) return;
    const next = !item.viewer_liked;
    setItems((p) => p.map((i) => (i.id === item.id ? applyLikeToggle(i, next) : i)));
    try {
      const { like, unlike } = socialFnsFor(item.feed_kind);
      if (next) await like(item.id, viewerId);
      else await unlike(item.id, viewerId);
    } catch {
      setItems((p) => p.map((i) => (i.id === item.id ? applyLikeToggle(i, !next) : i)));
    }
  }, [viewerId]);

  // ── Day tab: read-only agenda of the owner's day ──────────────────────────
  // Only for OTHER users — your own calendar lives on the home tab, so the Me
  // page skips the day-view and just shows your activity.
  const isSelf = targetId === viewerId;
  const showDay = !isSelf && tab === 'day';
  const anchorIso = selectedDate ?? isoDate(now);
  const habitMap = useMemo(
    () => new Map(userHabitsToHabits(habits, targetId).map((h) => [h.id, h])),
    [habits, targetId],
  );

  const loadDayWindow = useCallback(
    async (centerIso: string) => {
      setDayLoading(true);
      try {
        const days = nDayRange(parseIsoLocal(addDaysIso(centerIso, -28)), 42); // [-28, +13]
        const from = days[0];
        const to = addDaysIso(days[days.length - 1], 1); // exclusive
        const { completions, overrides } = await fetchUserDayData(targetId, from, to);
        const full = userHabitsToHabits(habits, targetId);
        const groups = buildDayGroups(days, full, completions, overrides, now);
        setDayGroups(new Map(groups.map((g) => [g.date, g])));
        dayWindow.current = { from, to };
      } finally {
        setDayLoading(false);
      }
    },
    [targetId, habits, now],
  );

  useEffect(() => {
    if (!showDay || habits.length === 0) return;
    const w = dayWindow.current;
    if (w && anchorIso >= w.from && anchorIso < w.to) return; // already covered
    loadDayWindow(anchorIso);
  }, [showDay, anchorIso, habits, loadDayWindow]);

  const dayGroup = dayGroups.get(anchorIso);

  const handleDayHabitPress = useCallback(
    (habitId: string) => {
      router.push({ pathname: '/habit/view', params: { id: habitId, occurrenceDate: anchorIso } });
    },
    [router, anchorIso],
  );

  const backHandler = onBack ?? (() => {});

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
          data={showDay ? [] : displayedItems}
          keyExtractor={(i) => i.id}
          contentContainerStyle={s.listContent}
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
                targetId={targetId}
                selectedLineageId={selectedLineageId} selectedDate={selectedDate}
                onSelectDate={handleDateSelect} habits={habits}
              />
              {selectedDate != null && (
                <ThemedText style={s.daySummary}>{formatDaySummary(selectedDate, selectedDayCount)}</ThemedText>
              )}
              {!isSelf && habits.length > 0 && (
                <View style={s.segmentWrap}>
                  <SegmentedControl options={TAB_OPTIONS} value={tab} onChange={setTab} />
                </View>
              )}
              {showDay && habits.length > 0 && (
                <View style={s.dayWrap}>
                  {dayLoading && dayGroups.size === 0 ? (
                    <View style={s.footer}><ActivityIndicator /></View>
                  ) : (
                    <ProfileDayAgenda group={dayGroup} habitMap={habitMap} onHabitPress={handleDayHabitPress} />
                  )}
                </View>
              )}
            </View>
          }
          renderItem={({ item }) =>
            item.feed_kind === 'habit_created'
              ? <FeedActivityCard {...cardProps(item)} />
              : <FeedCard {...cardProps(item)} onEdit={item.owner_id === viewerId ? () => router.push(`/completion/${item.id}`) : undefined} />
          }
          ItemSeparatorComponent={Sep}
          ListEmptyComponent={
            showDay
              ? null
              : loading
                ? <View style={s.footer}><ActivityIndicator /></View>
                : <ThemedText style={s.empty}>No activity yet</ThemedText>
          }
          ListFooterComponent={paging && !showDay ? <View style={s.footer}><ActivityIndicator /></View> : null}
          onEndReached={showDay ? undefined : loadMore}
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
      <MutualFriendsModal visible={mutualModalOpen} targetId={targetId} onClose={() => setMutualModalOpen(false)} />
    </>
  );
}

function Sep() {
  const t = useTokens();
  return <View style={[s.sep, { backgroundColor: t.hairlineStrong }]} />;
}

function parseIsoLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDaysIso(iso: string, n: number): string {
  const d = parseIsoLocal(iso);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}


const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingBottom: 120 },
  muted: { opacity: 0.6, fontSize: 15 },
  daySummary: { paddingHorizontal: 14, paddingBottom: 4, fontSize: 13, opacity: 0.7 },
  segmentWrap: { paddingHorizontal: 14, paddingVertical: 8 },
  dayWrap: { paddingTop: 4, paddingBottom: 12 },
  empty: { textAlign: 'center', opacity: 0.5, paddingTop: 40, fontSize: 15 },
  sep: { height: StyleSheet.hairlineWidth, marginHorizontal: 14 },
  footer: { paddingVertical: 18, alignItems: 'center' },
});
