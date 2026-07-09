import { dayItemKey } from '../day-item-key';
import { buildDayItems, UNGROUPED } from '../day-items';
import type { GroupMembership, HabitGroup } from '../groups';
import type { Habit } from '../habits';
import type { AgendaRow } from '../history';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function habit(id: string, sort_index: number, lineage_id = id): Habit {
  return {
    id,
    lineage_id,
    owner_id: 'u1',
    kind: 'scheduled',
    title: id,
    description: null,
    color: null,
    icon: null,
    visibility: 'private',
    timezone: 'UTC',
    dtstart: '2026-06-01T07:00:00Z',
    rrule: 'FREQ=DAILY',
    until: null,
    target_count: null,
    target_period: null,
    unit: 'count',
    count_unit: null,
    target_seconds: null,
    display_unit: null,
    sort_index,
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    deleted_at: null,
  };
}

function scheduledRow(habitId: string): AgendaRow {
  return {
    kind: 'scheduled',
    habitId,
    habit: {
      id: habitId,
      title: habitId,
      description: null,
      icon: null,
      color: null,
      unit: 'count',
    },
    time: null,
  };
}

function completionRow(habitId: string, id = `c-${habitId}`): AgendaRow {
  return {
    kind: 'completion',
    id,
    habit: {
      id: habitId,
      title: habitId,
      description: null,
      icon: null,
      color: null,
      unit: 'count',
    },
    time: new Date('2026-06-25T08:00:00Z'),
    isFlex: false,
  };
}

function group(id: string, sort_index: number, collapsed = false): HabitGroup {
  return {
    id,
    owner_id: 'u1',
    name: id,
    color: null,
    icon: null,
    sort_index,
    collapsed,
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    deleted_at: null,
  };
}

function member(lineage_id: string, group_id: string): GroupMembership {
  return {
    id: `${group_id}-${lineage_id}`,
    group_id,
    lineage_id,
    owner_id: 'u1',
    effective_from: '2026-06-01',
    effective_until: null,
    created_at: '2026-06-01T00:00:00Z',
  };
}

const ISO = '2026-06-25';

function build(
  rows: AgendaRow[],
  habits: Habit[],
  groups: HabitGroup[],
  members: GroupMembership[],
  restingExpanded = new Set<string>(),
) {
  const habitMap = new Map(habits.map((h) => [h.id, h]));
  return buildDayItems({
    rows,
    habitMap,
    groups,
    memberships: members,
    dateIso: ISO,
    restingExpanded,
  });
}

describe('buildDayItems — grouping', () => {
  it('emits one group card per non-empty group, in sort_index order: header, rows, footer', () => {
    const habits = [habit('A', 1), habit('B', 2)];
    const rows = [scheduledRow('A'), scheduledRow('B')];
    const groups = [group('G2', 2), group('G1', 1)];
    const members = [member('A', 'G1'), member('B', 'G2')];

    const items = build(rows, habits, groups, members);

    expect(items[0]).toMatchObject({ kind: 'group-header', groupId: 'G1' });
    expect(items[1]).toMatchObject({ kind: 'row', groupId: 'G1', section: 'notCompleted' });
    expect((items[1] as any).row.habitId).toBe('A');
    expect(items[2]).toMatchObject({ kind: 'group-footer', groupId: 'G1' });
    expect(items[3]).toMatchObject({ kind: 'group-header', groupId: 'G2' });
    expect(items[4]).toMatchObject({ kind: 'row', groupId: 'G2', section: 'notCompleted' });
    expect((items[4] as any).row.habitId).toBe('B');
    expect(items[5]).toMatchObject({ kind: 'group-footer', groupId: 'G2' });
  });

  it('a collapsed group emits header + footer only — the card reads as one closed pill bar', () => {
    const habits = [habit('A', 1)];
    const rows = [scheduledRow('A')];
    const groups = [group('G1', 1, /* collapsed */ true)];
    const members = [member('A', 'G1')];

    const items = build(rows, habits, groups, members);

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ kind: 'group-header', groupId: 'G1', collapsed: true });
    expect(items[1]).toMatchObject({ kind: 'group-footer', groupId: 'G1' });
  });

  it('a habit in TWO identities appears inside both cards (multi-identity)', () => {
    const habits = [habit('A', 1)];
    const rows = [scheduledRow('A')];
    const groups = [group('G1', 1), group('G2', 2)];
    const members = [member('A', 'G1'), member('A', 'G2')];

    const items = build(rows, habits, groups, members);

    const rowItems = items.filter((i) => i.kind === 'row');
    expect(rowItems).toHaveLength(2);
    expect(rowItems.map((i) => (i as any).groupId).sort()).toEqual(['G1', 'G2']);
    expect(items.some((i) => i.kind === 'group-header' && i.groupId === 'G1')).toBe(true);
    expect(items.some((i) => i.kind === 'group-header' && i.groupId === 'G2')).toBe(true);
  });

  it('skips a group that has no rows for the day', () => {
    const habits = [habit('A', 1)];
    const rows = [scheduledRow('A')];
    const groups = [group('G1', 1), group('G2', 2)];
    const members = [member('A', 'G1')]; // G2 has no member rows today

    const items = build(rows, habits, groups, members);

    expect(items.some((i) => i.kind === 'group-header' && i.groupId === 'G2')).toBe(false);
    expect(items.some((i) => i.kind === 'group-header' && i.groupId === 'G1')).toBe(true);
  });

  it('renders ungrouped rows after all group cards, with no group-header', () => {
    const habits = [habit('A', 1), habit('U', 2)];
    const rows = [scheduledRow('A'), scheduledRow('U')];
    const groups = [group('G1', 1)];
    const members = [member('A', 'G1')]; // U has no membership

    const items = build(rows, habits, groups, members);

    const lastGroupHeaderIdx = items.findIndex((i) => i.kind === 'group-header');
    const ungroupedRowIdx = items.findIndex(
      (i) => i.kind === 'row' && (i as any).row.habitId === 'U',
    );
    // ungrouped row comes after the (only) group header, and is tagged UNGROUPED.
    expect(ungroupedRowIdx).toBeGreaterThan(lastGroupHeaderIdx);
    expect(items[ungroupedRowIdx]).toMatchObject({ groupId: UNGROUPED });
  });

  it('a habit whose membership points at a group missing from the list (soft-deleted) renders ungrouped instead of vanishing', () => {
    // Regression: deleteGroup soft-deletes, so an open membership can outlive
    // its group. fetchGroups filters deleted groups; the row must fall back to
    // the ungrouped pile, never silently drop out of the day view.
    const habits = [habit('A', 1)];
    const rows = [scheduledRow('A')];
    const members = [member('A', 'G-deleted')];

    const items = build(rows, habits, /* groups */ [], members);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: 'row', groupId: UNGROUPED });
    expect((items[0] as any).row.habitId).toBe('A');
  });

  it('a habit removed-going-forward (window closed before the day) is ungrouped that day', () => {
    const habits = [habit('A', 1)];
    const rows = [scheduledRow('A')];
    const groups = [group('G1', 1)];
    const closed: GroupMembership = {
      ...member('A', 'G1'),
      effective_until: '2026-06-20', // closed before ISO 06-25
    };

    const items = build(rows, habits, groups, [closed]);

    // No group card (G1 has no rows this day); A renders ungrouped.
    expect(items.some((i) => i.kind === 'group-header')).toBe(false);
    expect(items[0]).toMatchObject({ kind: 'row', groupId: UNGROUPED });
  });
});

describe('buildDayItems — sections within a group', () => {
  it('orders not-completed then completed rows inside the card, with NO Completed divider', () => {
    const habits = [habit('A', 1), habit('B', 2)];
    const rows = [scheduledRow('A'), completionRow('B')];
    const groups = [group('G1', 1)];
    const members = [member('A', 'G1'), member('B', 'G1')];

    const items = build(rows, habits, groups, members);

    expect(items[0]).toMatchObject({ kind: 'group-header', groupId: 'G1' });
    expect(items[1]).toMatchObject({ kind: 'row', section: 'notCompleted' });
    // No completed-header inside a group card — the completed row drops straight
    // to the bottom of the list.
    expect(items[2]).toMatchObject({ kind: 'row', section: 'completed' });
    expect(items.some((i) => i.kind === 'completed-header')).toBe(false);
  });

  it('a group with everything completed shows just the rows — no "all done" line', () => {
    const habits = [habit('A', 1)];
    const rows = [completionRow('A')];
    const groups = [group('G1', 1)];
    const members = [member('A', 'G1')];

    const items = build(rows, habits, groups, members);

    expect(items[0]).toMatchObject({ kind: 'group-header', groupId: 'G1' });
    expect(items[1]).toMatchObject({ kind: 'row', section: 'completed' });
    expect(items.some((i) => i.kind === 'all-done')).toBe(false);
  });

  it('the ungrouped pile keeps the legacy Completed divider', () => {
    const habits = [habit('A', 1), habit('U', 2)];
    // A is grouped (forces a card so the ungrouped pile is a real bucket); U is
    // ungrouped and completed.
    const rows = [scheduledRow('A'), completionRow('U')];
    const groups = [group('G1', 1)];
    const members = [member('A', 'G1')];

    const items = build(rows, habits, groups, members);

    expect(items.some((i) => i.kind === 'completed-header' && i.groupId === UNGROUPED)).toBe(true);
  });
});

describe('buildDayItems — key stability across expand/collapse', () => {
  it('expanding a card never changes the keys of items that were already visible', () => {
    // Regression (pill animation): 3 collapsed identities + an ungrouped pile
    // of 2 incomplete habits and 1 completion. Expanding the top identity must
    // only ADD keys — any changed key would remount a row and fade instead of
    // slide during the layout transition.
    const habits = [
      habit('g1a', 1), habit('g2a', 2), habit('g3a', 3),
      habit('u1', 4), habit('u2', 5), habit('u3', 6),
    ];
    const rows = [
      scheduledRow('g1a'), scheduledRow('g2a'), scheduledRow('g3a'),
      scheduledRow('u1'), scheduledRow('u2'), completionRow('u3'),
    ];
    const groups = [group('G1', 1, true), group('G2', 2, true), group('G3', 3, true)];
    const members = [member('g1a', 'G1'), member('g2a', 'G2'), member('g3a', 'G3')];

    const collapsedKeys = build(rows, habits, groups, members).map(dayItemKey);
    const expandedGroups = [group('G1', 1, false), group('G2', 2, true), group('G3', 3, true)];
    const expandedKeys = build(rows, habits, expandedGroups, members).map(dayItemKey);

    // No duplicates in either state.
    expect(new Set(collapsedKeys).size).toBe(collapsedKeys.length);
    expect(new Set(expandedKeys).size).toBe(expandedKeys.length);
    // Every pre-expand key survives, unchanged.
    for (const k of collapsedKeys) {
      expect(expandedKeys).toContain(k);
    }
  });
});
