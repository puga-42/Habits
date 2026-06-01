import { buildWidgetPayload } from '../widget-sync';
import type { Completion, Habit, HabitOverride } from '../habits';

function scheduled(id: string, overrides?: Partial<Habit>): Habit {
  return {
    id,
    lineage_id: id,
    owner_id: 'u1',
    kind: 'scheduled',
    title: `Habit ${id}`,
    description: null,
    color: '#4A90D9',
    icon: '🧘',
    visibility: 'private',
    timezone: 'UTC',
    dtstart: '2026-05-01T07:00:00Z',
    rrule: 'FREQ=DAILY',
    until: null,
    target_count: null,
    target_period: null,
    sort_index: 0,
    created_at: '2026-05-01T00:00:00Z',
    updated_at: '2026-05-01T00:00:00Z',
    deleted_at: null,
    ...overrides,
  };
}

function flex(id: string, overrides?: Partial<Habit>): Habit {
  return {
    id,
    lineage_id: id,
    owner_id: 'u1',
    kind: 'flex',
    title: `Flex ${id}`,
    description: null,
    color: '#E85D75',
    icon: '🏋️',
    visibility: 'private',
    timezone: 'UTC',
    dtstart: null,
    rrule: null,
    until: null,
    target_count: 3,
    target_period: 'week',
    sort_index: 0,
    created_at: '2026-05-01T00:00:00Z',
    updated_at: '2026-05-01T00:00:00Z',
    deleted_at: null,
    ...overrides,
  };
}

function completion(
  habitId: string,
  overrides?: Partial<Completion>,
): Completion {
  return {
    id: `c-${habitId}`,
    habit_id: habitId,
    owner_id: 'u1',
    occurrence_date: '2026-05-28',
    period_start: null,
    completed_at: '2026-05-28T08:00:00Z',
    note: null,
    visibility_override: null,
    created_at: '2026-05-28T08:00:00Z',
    updated_at: '2026-05-28T08:00:00Z',
    ...overrides,
  };
}

function override(
  habitId: string,
  occurrenceDate: string,
  kind: HabitOverride['kind'] = 'skip',
): HabitOverride {
  return {
    id: `o-${habitId}`,
    habit_id: habitId,
    occurrence_date: occurrenceDate,
    kind,
    patch: null,
    created_at: '2026-05-28T00:00:00Z',
  };
}

const TODAY = new Date('2026-05-28T12:00:00Z');
const TODAY_ISO = '2026-05-28';

describe('buildWidgetPayload', () => {
  it('returns empty habits for empty input', () => {
    const result = buildWidgetPayload([], [], [], TODAY);
    expect(result.habits).toEqual([]);
    expect(result.updatedAt).toBeDefined();
  });

  it('includes scheduled habits with today occurrence', () => {
    const habits = [scheduled('h1')];
    const result = buildWidgetPayload(habits, [], [], TODAY);
    expect(result.habits).toHaveLength(1);
    expect(result.habits[0]).toMatchObject({
      id: 'h1',
      title: 'Habit h1',
      kind: 'scheduled',
      isCompleted: false,
      icon: '🧘',
      color: '#4A90D9',
    });
  });

  it('marks scheduled habit as completed when matching completion exists', () => {
    const habits = [scheduled('h1')];
    const completions = [completion('h1', { occurrence_date: TODAY_ISO })];
    const result = buildWidgetPayload(habits, completions, [], TODAY);
    expect(result.habits[0].isCompleted).toBe(true);
  });

  it('excludes skipped occurrences', () => {
    const habits = [scheduled('h1')];
    const overrides = [override('h1', TODAY_ISO, 'skip')];
    const result = buildWidgetPayload(habits, [], overrides, TODAY);
    expect(result.habits).toHaveLength(0);
  });

  it('keeps non-skip overrides (edit, reschedule)', () => {
    const habits = [scheduled('h1')];
    const overrides = [override('h1', TODAY_ISO, 'edit')];
    const result = buildWidgetPayload(habits, [], overrides, TODAY);
    expect(result.habits).toHaveLength(1);
  });

  it('excludes habits without today occurrence', () => {
    const habits = [
      scheduled('h1', { rrule: 'FREQ=WEEKLY;BYDAY=SU', dtstart: '2026-05-03T07:00:00Z' }),
    ];
    // 2026-05-28 is a Thursday, so a Sunday-only habit should not appear
    const result = buildWidgetPayload(habits, [], [], TODAY);
    expect(result.habits).toHaveLength(0);
  });

  it('includes flex habits with progress', () => {
    const habits = [flex('f1')];
    const weekPeriodStart = '2026-05-25'; // Monday of the week containing 2026-05-28
    const completions = [
      completion('f1', { occurrence_date: null, period_start: weekPeriodStart }),
    ];
    const result = buildWidgetPayload(habits, completions, [], TODAY);
    expect(result.habits).toHaveLength(1);
    expect(result.habits[0]).toMatchObject({
      id: 'f1',
      kind: 'flex',
      isCompleted: false,
      targetCount: 3,
      completedCount: 1,
    });
  });

  it('marks flex habit as completed when target met', () => {
    const habits = [flex('f1', { target_count: 2 })];
    const weekPeriodStart = '2026-05-25';
    const completions = [
      completion('f1', { id: 'c1', occurrence_date: null, period_start: weekPeriodStart }),
      completion('f1', { id: 'c2', occurrence_date: null, period_start: weekPeriodStart }),
    ];
    const result = buildWidgetPayload(habits, completions, [], TODAY);
    expect(result.habits[0].isCompleted).toBe(true);
    expect(result.habits[0].completedCount).toBe(2);
  });

  it('includes both scheduled and flex habits', () => {
    const habits = [scheduled('h1'), flex('f1')];
    const result = buildWidgetPayload(habits, [], [], TODAY);
    expect(result.habits).toHaveLength(2);
    expect(result.habits[0].kind).toBe('scheduled');
    expect(result.habits[1].kind).toBe('flex');
  });

  it('skips flex habits without target_count or target_period', () => {
    const habits = [flex('f1', { target_count: null })];
    const result = buildWidgetPayload(habits, [], [], TODAY);
    expect(result.habits).toHaveLength(0);
  });
});
