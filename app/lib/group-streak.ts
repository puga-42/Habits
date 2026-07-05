// Group streak — "any member completed", counted daily, walking back from
// today. Groups are wrappers around habits: the streak is computed over the
// FULL completion history of the group's *current* members (membership window
// covering today), regardless of when they joined — a habit added today brings
// its existing streak with it, and a removed habit stops crediting. Membership
// windows still govern day-view bucketing and one-active-group; they no longer
// gate metrics. Today is neutral if nothing is logged yet (the day isn't
// over); any earlier day with no member completion ends the streak.
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
  const todayIso = isoDate(now);

  // Current members: lineages with a membership of this group covering today.
  const lineages = new Set<string>();
  for (const m of input.memberships) {
    if (m.group_id !== input.groupId) continue;
    if (!groupContainsOn(m, todayIso)) continue;
    lineages.add(m.lineage_id);
  }
  if (lineages.size === 0) return 0;

  // Union of the members' completion days — their whole history counts.
  const completedDays = new Set<string>();
  for (const lin of lineages) {
    for (const day of input.completionDaysByLineage.get(lin) ?? []) {
      completedDays.add(day);
    }
  }
  if (completedDays.size === 0) return 0;

  const earliest = [...completedDays].reduce((a, b) => (b < a ? b : a));

  let streak = 0;
  let cursor = todayIso;
  for (let guard = 0; guard < MAX_DAYS && cursor >= earliest; guard++) {
    if (completedDays.has(cursor)) {
      streak++;
    } else if (cursor !== todayIso) {
      break; // a genuine miss on a past day ends the streak (today is neutral)
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
