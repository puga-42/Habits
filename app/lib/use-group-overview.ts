// Data hook for the group overview screen. Loads the group, its memberships and
// member habits, each member's stats (exact count + streak inputs), then derives
// the group metrics with the pure helpers in group-overview.ts + the shared
// computeGroupStreak (same function the day-view card uses, so they agree).
// Mirrors lib/use-habit-overview.ts. Failures degrade to empty rather than throw
// so the page renders what it can.

import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import {
  activeMemberLineages,
  currentHabitByLineage,
  fetchGroup,
  fetchGroupMemberPhotos,
  signMemberPhotos,
  type GroupWithDescription,
  type MemberPhoto,
} from './group-overview';
import { computeGroupStreak } from './group-streak';
import { fetchMemberships, type GroupMembership } from './groups';
import { fetchHabitStats, habitStreak } from './habit-stats';
import { fetchHabits, isoDate, type Habit } from './habits';

export type GroupMember = { habit: Habit; streak: number; count: number };

export type GroupOverviewState = {
  group: GroupWithDescription | null;
  members: GroupMember[];
  memberCount: number;
  streak: number;
  completions: number;
  photoUrls: string[];
  loading: boolean;
  reload: () => void;
};

export function useGroupOverview(
  groupId: string | undefined,
  ownerId: string | undefined,
): GroupOverviewState {
  const [group, setGroup] = useState<GroupWithDescription | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [completions, setCompletions] = useState(0);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!groupId || !ownerId) return;
    const now = new Date();
    const todayIso = isoDate(now);

    const [g, memberships, habits] = await Promise.all([
      fetchGroup(groupId).catch(() => null),
      fetchMemberships(ownerId).catch(() => [] as GroupMembership[]),
      fetchHabits(ownerId).catch(() => [] as Habit[]),
    ]);
    setGroup(g);

    const lineages = activeMemberLineages(memberships, groupId, todayIso);
    setMemberCount(lineages.length);
    const byLineage = currentHabitByLineage(habits);

    // Per-member stats: exact all-time count + the streak inputs.
    const statsList = await Promise.all(
      lineages.map((lin) => fetchHabitStats(ownerId, lin).catch(() => null)),
    );

    const daysByLineage = new Map<string, Set<string>>();
    const memberRows: GroupMember[] = [];
    lineages.forEach((lin, i) => {
      const stats = statsList[i];
      if (stats) daysByLineage.set(lin, new Set(stats.completion_history));
      const habit = byLineage.get(lin);
      if (!habit) return; // lineage with no current row (deleted) — skip the row
      memberRows.push({
        habit,
        streak: stats ? habitStreak(habit, stats, now) : 0,
        count: stats?.completion_count ?? 0,
      });
    });
    setMembers(memberRows);

    setStreak(
      computeGroupStreak(
        { groupId, memberships, completionDaysByLineage: daysByLineage },
        now,
      ),
    );
    // Groups are wrappers around habits: the group's completions are the sum of
    // its current members' exact all-time counts — the header always agrees
    // with the member rows below it (not window-scoped; see group-streak.ts).
    setCompletions(memberRows.reduce((sum, r) => sum + r.count, 0));

    // Mosaic: recent photos across every habit row of the member lineages.
    const memberHabitIds = habits
      .filter((h) => lineages.includes(h.lineage_id))
      .map((h) => h.id);
    const photos = await fetchGroupMemberPhotos(memberHabitIds).catch(
      () => [] as MemberPhoto[],
    );
    const urls = await signMemberPhotos(photos).catch(() => new Map<string, string>());
    setPhotoUrls(
      photos
        .map((p) => urls.get(p.path))
        .filter((u): u is string => Boolean(u)),
    );
  }, [groupId, ownerId]);

  // Load on focus, not just mount: coming back from /group/edit (or any pushed
  // screen) must show the fresh name/description/members. The spinner only
  // gates the first load — refocus refreshes in place without flashing.
  useFocusEffect(
    useCallback(() => {
      load().finally(() => setLoading(false));
    }, [load]),
  );

  return {
    group,
    members,
    memberCount,
    streak,
    completions,
    photoUrls,
    loading,
    reload: () => {
      load();
    },
  };
}
