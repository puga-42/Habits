import { computeGroupStreak, type GroupStreakInput } from '../group-streak';
import type { GroupMembership } from '../groups';

function member(
  lineage_id: string,
  group_id: string,
  effective_from: string,
  effective_until: string | null = null,
): GroupMembership {
  return {
    id: `${group_id}-${lineage_id}-${effective_from}`,
    group_id,
    lineage_id,
    owner_id: 'u1',
    effective_from,
    effective_until,
    created_at: '2026-01-01T00:00:00Z',
  };
}

function days(...d: string[]): Set<string> {
  return new Set(d);
}

// Local noon avoids DST edges in the test's "now".
const NOW = new Date(2026, 5, 25, 12, 0, 0); // 2026-06-25

function input(over: Partial<GroupStreakInput>): GroupStreakInput {
  return {
    groupId: 'G1',
    memberships: [],
    completionDaysByLineage: new Map(),
    ...over,
  };
}

describe('computeGroupStreak', () => {
  it('returns 0 for a group with no members', () => {
    expect(computeGroupStreak(input({ memberships: [] }), NOW)).toBe(0);
  });

  it('counts consecutive days where ANY active member completed', () => {
    // Two members; on each of the last 3 days at least one completed.
    const memberships = [
      member('A', 'G1', '2026-06-01'),
      member('B', 'G1', '2026-06-01'),
    ];
    const completionDaysByLineage = new Map([
      ['A', days('2026-06-25', '2026-06-23')],
      ['B', days('2026-06-24')],
    ]);
    // 06-25 (A), 06-24 (B), 06-23 (A) → 3.
    expect(computeGroupStreak(input({ memberships, completionDaysByLineage }), NOW)).toBe(3);
  });

  it('today is neutral when nothing is logged yet (does not break the streak)', () => {
    const memberships = [member('A', 'G1', '2026-06-01')];
    const completionDaysByLineage = new Map([['A', days('2026-06-24', '2026-06-23')]]);
    // Nothing today; yesterday + the day before counted → 2.
    expect(computeGroupStreak(input({ memberships, completionDaysByLineage }), NOW)).toBe(2);
  });

  it('a past day with active members and no completion ends the streak', () => {
    const memberships = [member('A', 'G1', '2026-06-01')];
    // 06-25 done, 06-24 missed, 06-23 done → streak stops at 06-24.
    const completionDaysByLineage = new Map([['A', days('2026-06-25', '2026-06-23')]]);
    expect(computeGroupStreak(input({ memberships, completionDaysByLineage }), NOW)).toBe(1);
  });

  it('a removed member contributes nothing — the group reflects its CURRENT habits', () => {
    // A left the group going forward (window closed 06-23). The group is a lens
    // over the habits in it today, so A's history no longer credits the streak.
    const memberships = [member('A', 'G1', '2026-06-01', '2026-06-23')];
    const completionDaysByLineage = new Map([['A', days('2026-06-23', '2026-06-22')]]);
    expect(computeGroupStreak(input({ memberships, completionDaysByLineage }), NOW)).toBe(0);
  });

  it('ignores completions from a member of a different group', () => {
    const memberships = [
      member('A', 'G1', '2026-06-01'),
      member('B', 'G2', '2026-06-01'), // different group
    ];
    const completionDaysByLineage = new Map([
      ['A', days('2026-06-25')],
      ['B', days('2026-06-24', '2026-06-23')],
    ]);
    // Only A counts for G1: 06-25 done, 06-24 missed → 1.
    expect(computeGroupStreak(input({ memberships, completionDaysByLineage }), NOW)).toBe(1);
  });

  it('counts completions from before the member joined (join date does not gate history)', () => {
    // A joined 06-24 with completions back to 06-23. Groups are wrappers around
    // habits — the habit's full history counts, regardless of when it joined.
    const memberships = [member('A', 'G1', '2026-06-24')];
    const completionDaysByLineage = new Map([['A', days('2026-06-25', '2026-06-24', '2026-06-23')]]);
    expect(computeGroupStreak(input({ memberships, completionDaysByLineage }), NOW)).toBe(3);
  });

  it('a member added TODAY credits its existing streak immediately (reported bug)', () => {
    // Habits with prior completions were added to a fresh group; the group must
    // not read 0. Nothing logged today → neutral; 06-24 + 06-23 count → 2.
    const memberships = [member('A', 'G1', '2026-06-25')];
    const completionDaysByLineage = new Map([['A', days('2026-06-24', '2026-06-23')]]);
    expect(computeGroupStreak(input({ memberships, completionDaysByLineage }), NOW)).toBe(2);
  });

  it('returns 0 when the only members have no completions at all', () => {
    const memberships = [member('A', 'G1', '2026-06-01')];
    expect(computeGroupStreak(input({ memberships }), NOW)).toBe(0);
  });
});
