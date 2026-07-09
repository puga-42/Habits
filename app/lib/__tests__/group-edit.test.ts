import { buildGroupHabitChoices, planMemberEdits } from '../group-edit';
import type { GroupMembership, HabitGroup } from '../groups';
import type { Habit } from '../habits';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function habit(
  id: string,
  overrides: Partial<Habit> & { lineage_id?: string } = {},
): Habit {
  return {
    id,
    lineage_id: id,
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
    sort_index: 1,
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    deleted_at: null,
    ...overrides,
  } as Habit;
}

function group(id: string, name = id): HabitGroup {
  return {
    id,
    owner_id: 'u1',
    name,
    color: null,
    icon: null,
    sort_index: 1,
    collapsed: false,
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

const TODAY = '2026-07-05';

describe('buildGroupHabitChoices', () => {
  it('marks active members of the edited group as inGroup', () => {
    const choices = buildGroupHabitChoices(
      [habit('A')],
      [member('A', 'G1')],
      [group('G1')],
      'G1',
      TODAY,
    );
    expect(choices).toEqual([
      { lineageId: 'A', title: 'A', icon: null, color: null, inGroup: true, otherGroupName: null },
    ]);
  });

  it("labels a habit in another group with that group's name", () => {
    const choices = buildGroupHabitChoices(
      [habit('A')],
      [member('A', 'G2')],
      [group('G1'), group('G2', 'Become healthy')],
      'G1',
      TODAY,
    );
    expect(choices[0]).toMatchObject({ inGroup: false, otherGroupName: 'Become healthy' });
  });

  it('an ungrouped habit has no group label', () => {
    const choices = buildGroupHabitChoices([habit('A')], [], [group('G1')], 'G1', TODAY);
    expect(choices[0]).toMatchObject({ inGroup: false, otherGroupName: null });
  });

  it('a membership pointing at a group missing from the list (soft-deleted) counts as ungrouped', () => {
    // Mirrors day-items: a group must never claim a habit after it is deleted.
    const choices = buildGroupHabitChoices(
      [habit('A')],
      [member('A', 'G-deleted')],
      [group('G1')],
      'G1',
      TODAY,
    );
    expect(choices[0]).toMatchObject({ inGroup: false, otherGroupName: null });
  });

  it('collapses a lineage to one row carrying the latest habit fields', () => {
    // "This and future" edits fork rows sharing a lineage_id (see CONTEXT.md).
    const older = habit('h1', { lineage_id: 'L1', title: 'Old title' });
    const newer = habit('h2', {
      lineage_id: 'L1',
      title: 'New title',
      dtstart: '2026-07-01T07:00:00Z',
    });
    const choices = buildGroupHabitChoices([older, newer], [], [], 'G1', TODAY);
    expect(choices).toHaveLength(1);
    expect(choices[0]).toMatchObject({ lineageId: 'L1', title: 'New title' });
  });

  it('sorts current members first, then alphabetically by title', () => {
    const choices = buildGroupHabitChoices(
      [habit('zeta'), habit('alpha'), habit('mid')],
      [member('zeta', 'G1')],
      [group('G1')],
      'G1',
      TODAY,
    );
    expect(choices.map((c) => c.lineageId)).toEqual(['zeta', 'alpha', 'mid']);
  });
});

describe('buildGroupHabitChoices — multi-identity', () => {
  it('a habit in this identity AND another is inGroup with the other named', () => {
    const choices = buildGroupHabitChoices(
      [habit('A')],
      [member('A', 'G1'), member('A', 'G2')],
      [group('G1'), group('G2', 'Become healthy')],
      'G1',
      TODAY,
    );
    expect(choices[0]).toMatchObject({ inGroup: true, otherGroupName: 'Become healthy' });
  });
});

describe('planMemberEdits', () => {
  it('adds newly selected lineages', () => {
    expect(planMemberEdits(['A'], ['A', 'B'])).toEqual({
      addLineageIds: ['B'],
      removeLineageIds: [],
    });
  });

  it('removes deselected lineages', () => {
    expect(planMemberEdits(['A', 'B'], ['A'])).toEqual({
      addLineageIds: [],
      removeLineageIds: ['B'],
    });
  });

  it('handles a swap in one edit', () => {
    expect(planMemberEdits(['A'], ['B'])).toEqual({
      addLineageIds: ['B'],
      removeLineageIds: ['A'],
    });
  });

  it('no-op when the selection is unchanged', () => {
    expect(planMemberEdits(['A', 'B'], ['B', 'A'])).toEqual({
      addLineageIds: [],
      removeLineageIds: [],
    });
  });
});

describe('buildGroupHabitChoices — creation flow (sentinel id)', () => {
  it('marks nothing inGroup for a not-yet-created identity, keeping the hints', () => {
    // The creation page passes a sentinel id (no row exists yet): no habit can
    // be a member, but habits in other identities still show the move hint.
    const choices = buildGroupHabitChoices(
      [habit('A'), habit('B')],
      [member('A', 'G1')],
      [group('G1', 'Become healthy')],
      '__new',
      TODAY,
    );
    expect(choices.every((c) => !c.inGroup)).toBe(true);
    expect(choices.find((c) => c.lineageId === 'A')?.otherGroupName).toBe('Become healthy');
    expect(choices.find((c) => c.lineageId === 'B')?.otherGroupName).toBeNull();
  });
});
