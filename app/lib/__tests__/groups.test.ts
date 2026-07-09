import { dayBefore } from '../group-mutations';
import {
  activeGroupIdFor,
  activeGroupIdsFor,
  groupContainsOn,
  nextGroupSortIndexFromList,
  planGroupChange,
  planMembershipEnd,
  type GroupMembership,
} from '../groups';

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

describe('groupContainsOn', () => {
  it('includes the effective_from day (inclusive lower bound)', () => {
    const mem = m({ lineage_id: 'L1', group_id: 'G1', effective_from: '2026-03-10' });
    expect(groupContainsOn(mem, '2026-03-10')).toBe(true);
  });

  it('excludes days before effective_from', () => {
    const mem = m({ lineage_id: 'L1', group_id: 'G1', effective_from: '2026-03-10' });
    expect(groupContainsOn(mem, '2026-03-09')).toBe(false);
  });

  it('an open-ended membership (null until) covers all later days, including the future', () => {
    const mem = m({ lineage_id: 'L1', group_id: 'G1', effective_from: '2026-03-10' });
    expect(groupContainsOn(mem, '2027-12-31')).toBe(true);
  });

  it('includes the effective_until day (inclusive upper bound) but not after', () => {
    const mem = m({
      lineage_id: 'L1',
      group_id: 'G1',
      effective_from: '2026-03-10',
      effective_until: '2026-04-15',
    });
    expect(groupContainsOn(mem, '2026-04-15')).toBe(true);
    expect(groupContainsOn(mem, '2026-04-16')).toBe(false);
  });
});

describe('activeGroupIdFor', () => {
  it('returns null when the lineage has no membership covering the day', () => {
    const memberships = [m({ lineage_id: 'L2', group_id: 'G1', effective_from: '2026-03-01' })];
    expect(activeGroupIdFor(memberships, 'L1', '2026-03-15')).toBeNull();
  });

  it('returns the group whose window covers the day', () => {
    const memberships = [m({ lineage_id: 'L1', group_id: 'G1', effective_from: '2026-03-01' })];
    expect(activeGroupIdFor(memberships, 'L1', '2026-03-15')).toBe('G1');
  });

  it('removed-going-forward: keeps the group for past days, drops it after', () => {
    // L1 was in G1 from Mar 1, removed going forward on Apr 1 (until = Mar 31).
    const memberships = [
      m({
        lineage_id: 'L1',
        group_id: 'G1',
        effective_from: '2026-03-01',
        effective_until: '2026-03-31',
      }),
    ];
    expect(activeGroupIdFor(memberships, 'L1', '2026-03-20')).toBe('G1');
    expect(activeGroupIdFor(memberships, 'L1', '2026-04-02')).toBeNull();
  });

  it('prefers the still-open membership when an old closed window also exists', () => {
    // Was in G1 (closed Mar 31), re-added to G2 open from Apr 1.
    const memberships = [
      m({
        lineage_id: 'L1',
        group_id: 'G1',
        effective_from: '2026-03-01',
        effective_until: '2026-03-31',
      }),
      m({ lineage_id: 'L1', group_id: 'G2', effective_from: '2026-04-01' }),
    ];
    expect(activeGroupIdFor(memberships, 'L1', '2026-03-15')).toBe('G1');
    expect(activeGroupIdFor(memberships, 'L1', '2026-04-15')).toBe('G2');
  });
});

describe('activeGroupIdsFor (multi-identity)', () => {
  it('returns every identity whose window covers the day', () => {
    const memberships = [
      m({ lineage_id: 'L1', group_id: 'G1', effective_from: '2026-03-01' }),
      m({ lineage_id: 'L1', group_id: 'G2', effective_from: '2026-03-10' }),
      m({ lineage_id: 'L2', group_id: 'G3', effective_from: '2026-03-01' }),
    ];
    expect(activeGroupIdsFor(memberships, 'L1', '2026-03-15')).toEqual(['G1', 'G2']);
  });

  it('excludes closed windows and dedupes multiple windows of one identity', () => {
    const memberships = [
      m({
        lineage_id: 'L1',
        group_id: 'G1',
        effective_from: '2026-03-01',
        effective_until: '2026-03-05',
      }),
      m({ lineage_id: 'L1', group_id: 'G1', effective_from: '2026-03-08' }),
      m({
        lineage_id: 'L1',
        group_id: 'G2',
        effective_from: '2026-03-01',
        effective_until: '2026-03-09',
      }),
    ];
    expect(activeGroupIdsFor(memberships, 'L1', '2026-03-15')).toEqual(['G1']);
  });

  it('returns empty for a lineage with no covering membership', () => {
    expect(activeGroupIdsFor([], 'L1', '2026-03-15')).toEqual([]);
  });
});

describe('nextGroupSortIndexFromList', () => {
  it('starts at 1 when there are no groups', () => {
    expect(nextGroupSortIndexFromList([])).toBe(1);
  });

  it('returns one past the current max', () => {
    expect(nextGroupSortIndexFromList([1, 2, 5])).toBe(6);
  });
});

describe('planGroupChange', () => {
  it('no-op when the group is unchanged (both null)', () => {
    expect(planGroupChange(null, null)).toEqual({ kind: 'none' });
  });

  it('no-op when staying in the same group', () => {
    expect(planGroupChange('G1', 'G1')).toEqual({ kind: 'none' });
  });

  it('adds when assigning a group to a previously-ungrouped habit', () => {
    expect(planGroupChange(null, 'G1')).toEqual({ kind: 'add', groupId: 'G1' });
  });

  it('picking a different identity is an add (other memberships are untouched)', () => {
    expect(planGroupChange('G1', 'G2')).toEqual({ kind: 'add', groupId: 'G2' });
  });

  it('removes (going forward) when clearing the group', () => {
    expect(planGroupChange('G1', null)).toEqual({ kind: 'remove', groupId: 'G1' });
  });
});

describe('planMembershipEnd', () => {
  // Ending a membership as of `fromIso` closes its window at the day before.
  // A membership that only began on/after `fromIso` never covered an earlier
  // day — closing it would violate the effective_until >= effective_from check
  // constraint (the "created habit + group, switched groups the same day"
  // save error) — so it must be deleted instead.
  it('closes memberships that began before fromIso', () => {
    const plan = planMembershipEnd(
      [{ id: 'm1', effective_from: '2026-06-01' }],
      '2026-07-04',
    );
    expect(plan).toEqual({ closeIds: ['m1'], deleteIds: [] });
  });

  it('deletes a membership that began on fromIso (same-day group switch)', () => {
    const plan = planMembershipEnd(
      [{ id: 'm1', effective_from: '2026-07-04' }],
      '2026-07-04',
    );
    expect(plan).toEqual({ closeIds: [], deleteIds: ['m1'] });
  });

  it('deletes a membership that began after fromIso', () => {
    const plan = planMembershipEnd(
      [{ id: 'm1', effective_from: '2026-07-10' }],
      '2026-07-04',
    );
    expect(plan).toEqual({ closeIds: [], deleteIds: ['m1'] });
  });

  it('partitions a mixed list', () => {
    const plan = planMembershipEnd(
      [
        { id: 'old', effective_from: '2026-06-01' },
        { id: 'today', effective_from: '2026-07-04' },
      ],
      '2026-07-04',
    );
    expect(plan).toEqual({ closeIds: ['old'], deleteIds: ['today'] });
  });

  it('returns an empty plan for no open memberships', () => {
    expect(planMembershipEnd([], '2026-07-04')).toEqual({ closeIds: [], deleteIds: [] });
  });
});

describe('dayBefore', () => {
  it('steps back one day within a month', () => {
    expect(dayBefore('2026-06-25')).toBe('2026-06-24');
  });

  it('rolls back across a month boundary', () => {
    expect(dayBefore('2026-07-01')).toBe('2026-06-30');
  });

  it('rolls back across a year boundary', () => {
    expect(dayBefore('2026-01-01')).toBe('2025-12-31');
  });

  it('handles leap-day February', () => {
    expect(dayBefore('2024-03-01')).toBe('2024-02-29');
  });
});
