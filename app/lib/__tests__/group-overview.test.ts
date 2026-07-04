import type { GroupMembership } from '../groups';
import type { Habit } from '../habits';
import {
  activeMemberLineages,
  countCompletionsInWindows,
  currentHabitByLineage,
} from '../group-overview';

function m(
  overrides: Partial<GroupMembership> & {
    lineage_id: string;
    group_id: string;
    effective_from: string;
  },
): GroupMembership {
  return {
    id: `${overrides.group_id}-${overrides.lineage_id}-${overrides.effective_from}`,
    owner_id: 'u1',
    effective_until: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function h(overrides: Partial<Habit> & { id: string; lineage_id: string }): Habit {
  return {
    owner_id: 'u1',
    kind: 'scheduled',
    title: overrides.id,
    description: null,
    color: null,
    icon: null,
    visibility: 'private',
    timezone: 'UTC',
    dtstart: '2026-03-01T00:00:00Z',
    rrule: 'FREQ=DAILY',
    until: null,
    target_count: null,
    target_period: null,
    unit: 'count',
    count_unit: null,
    target_seconds: null,
    display_unit: null,
    sort_index: 0,
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
    deleted_at: null,
    ...overrides,
  } as Habit;
}

describe('activeMemberLineages', () => {
  it('returns the distinct lineages whose window covers the day', () => {
    const memberships = [
      m({ lineage_id: 'L1', group_id: 'G1', effective_from: '2026-03-01' }),
      m({ lineage_id: 'L2', group_id: 'G1', effective_from: '2026-03-01' }),
    ];
    expect(activeMemberLineages(memberships, 'G1', '2026-03-15').sort()).toEqual(['L1', 'L2']);
  });

  it('ignores memberships of other groups', () => {
    const memberships = [
      m({ lineage_id: 'L1', group_id: 'G1', effective_from: '2026-03-01' }),
      m({ lineage_id: 'L2', group_id: 'G2', effective_from: '2026-03-01' }),
    ];
    expect(activeMemberLineages(memberships, 'G1', '2026-03-15')).toEqual(['L1']);
  });

  it('excludes a lineage whose window has closed before the day', () => {
    const memberships = [
      m({
        lineage_id: 'L1',
        group_id: 'G1',
        effective_from: '2026-03-01',
        effective_until: '2026-03-10',
      }),
    ];
    expect(activeMemberLineages(memberships, 'G1', '2026-03-15')).toEqual([]);
  });

  it('dedupes a lineage that has multiple windows covering the day', () => {
    const memberships = [
      m({ lineage_id: 'L1', group_id: 'G1', effective_from: '2026-03-01', effective_until: '2026-03-31' }),
      m({ lineage_id: 'L1', group_id: 'G1', effective_from: '2026-03-15' }),
    ];
    expect(activeMemberLineages(memberships, 'G1', '2026-03-20')).toEqual(['L1']);
  });
});

describe('countCompletionsInWindows', () => {
  it('counts only completion days that fall within a member window', () => {
    const memberships = [
      m({
        lineage_id: 'L1',
        group_id: 'G1',
        effective_from: '2026-03-10',
        effective_until: '2026-03-20',
      }),
    ];
    const days = new Map<string, Set<string>>([
      // 03-05 is before the window, 03-25 is after — both excluded.
      ['L1', new Set(['2026-03-05', '2026-03-12', '2026-03-15', '2026-03-25'])],
    ]);
    expect(countCompletionsInWindows(memberships, 'G1', days)).toBe(2);
  });

  it('sums across members and ignores other groups', () => {
    const memberships = [
      m({ lineage_id: 'L1', group_id: 'G1', effective_from: '2026-03-01' }),
      m({ lineage_id: 'L2', group_id: 'G1', effective_from: '2026-03-01' }),
      m({ lineage_id: 'L3', group_id: 'G2', effective_from: '2026-03-01' }),
    ];
    const days = new Map<string, Set<string>>([
      ['L1', new Set(['2026-03-02', '2026-03-03'])],
      ['L2', new Set(['2026-03-04'])],
      ['L3', new Set(['2026-03-05', '2026-03-06'])],
    ]);
    expect(countCompletionsInWindows(memberships, 'G1', days)).toBe(3);
  });

  it('counts a day twice when two members both completed on it (distinct completions)', () => {
    const memberships = [
      m({ lineage_id: 'L1', group_id: 'G1', effective_from: '2026-03-01' }),
      m({ lineage_id: 'L2', group_id: 'G1', effective_from: '2026-03-01' }),
    ];
    const days = new Map<string, Set<string>>([
      ['L1', new Set(['2026-03-10'])],
      ['L2', new Set(['2026-03-10'])],
    ]);
    expect(countCompletionsInWindows(memberships, 'G1', days)).toBe(2);
  });

  it('is zero when a member has no recorded days', () => {
    const memberships = [m({ lineage_id: 'L1', group_id: 'G1', effective_from: '2026-03-01' })];
    expect(countCompletionsInWindows(memberships, 'G1', new Map())).toBe(0);
  });
});

describe('currentHabitByLineage', () => {
  it('maps each lineage to its single habit row', () => {
    const habits = [h({ id: 'A', lineage_id: 'L1' }), h({ id: 'B', lineage_id: 'L2' })];
    const map = currentHabitByLineage(habits);
    expect(map.get('L1')?.id).toBe('A');
    expect(map.get('L2')?.id).toBe('B');
  });

  it('prefers the latest-starting row when a lineage has several (this-and-future edits)', () => {
    const habits = [
      h({ id: 'old', lineage_id: 'L1', dtstart: '2026-03-01T00:00:00Z' }),
      h({ id: 'new', lineage_id: 'L1', dtstart: '2026-05-01T00:00:00Z' }),
    ];
    expect(currentHabitByLineage(habits).get('L1')?.id).toBe('new');
  });

  it('falls back to created_at when dtstart is null (flex habits)', () => {
    const habits = [
      h({ id: 'old', lineage_id: 'L1', dtstart: null, created_at: '2026-03-01T00:00:00Z' }),
      h({ id: 'new', lineage_id: 'L1', dtstart: null, created_at: '2026-05-01T00:00:00Z' }),
    ];
    expect(currentHabitByLineage(habits).get('L1')?.id).toBe('new');
  });
});
