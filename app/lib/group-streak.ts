// Group streak — "any active member completed", counted daily, walking back from
// today. A day counts toward the streak if at least one habit whose membership
// window covered that day was completed on it. Today is neutral if nothing is
// logged yet (the day isn't over); a day on which the group had ≥1 active member
// but none completed ends the streak. Days where the group had no active member
// (before it formed, or a gap between memberships) are bridged as neutral.
//
// This is the group-level analogue of lib/streak.ts. Pure + TDD'd; see
// __tests__/group-streak.test.ts. No network, no mocks.
//
// NOTE on data source: callers build completionDaysByLineage from the lineage
// completion history. For scheduled members those are exact occurrence
// calendar-days; for flex members the history is period_starts, so a flex
// completion currently credits its period-start day (a documented approximation
// — a dedicated member-completion-days query can refine this later).

import { groupContainsOn, type GroupMembership } from './groups';
import { isoDate } from './habits';

export type GroupStreakInput = {
  groupId: string;
  // Any memberships (across groups); only this group's are considered.
  memberships: GroupMembership[];
  // Completion calendar-days (YYYY-MM-DD) per member lineage_id.
  completionDaysByLineage: Map<string, Set<string>>;
};

// Hard ceiling on the walk-back so a malformed input can never loop forever
// (mirrors the bounded walk in lib/streak.ts flexStreak).
const MAX_DAYS = 4000;

export function computeGroupStreak(input: GroupStreakInput, now: Date): number {
  const members = input.memberships.filter((m) => m.group_id === input.groupId);
  if (members.length === 0) return 0;

  // Stop walking once we pass the earliest day any member belonged to the group.
  const earliest = members.reduce(
    (min, m) => (m.effective_from < min ? m.effective_from : min),
    members[0].effective_from,
  );

  const todayIso = isoDate(now);
  let streak = 0;
  let cursor = todayIso;

  for (let guard = 0; guard < MAX_DAYS && cursor >= earliest; guard++) {
    const activeMembers = members.filter((m) => groupContainsOn(m, cursor));

    if (activeMembers.length === 0) {
      // The group had no member on this day — neutral, bridge over it.
      cursor = prevDay(cursor);
      continue;
    }

    const completed = activeMembers.some((m) =>
      input.completionDaysByLineage.get(m.lineage_id)?.has(cursor),
    );

    if (completed) {
      streak++;
    } else if (cursor === todayIso) {
      // Today isn't over — neutral, keep walking.
    } else {
      break; // a genuine miss on a day the group was active ends the streak
    }

    cursor = prevDay(cursor);
  }

  return streak;
}

// YYYY-MM-DD one day earlier (UTC-noon to dodge DST edges).
function prevDay(iso: string): string {
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() - 1);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}
