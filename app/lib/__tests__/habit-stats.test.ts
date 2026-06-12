import { habitStreak, type HabitStats } from '../habit-stats';
import type { Habit } from '../habits';

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'h1',
    lineage_id: 'h1',
    owner_id: 'u1',
    kind: 'scheduled',
    title: 'Meditate',
    description: null,
    color: '#aaa',
    icon: '🧘',
    visibility: 'friends',
    timezone: 'UTC',
    dtstart: '2026-06-01T08:00:00Z',
    rrule: 'FREQ=DAILY',
    until: null,
    target_count: null,
    target_period: null,
    unit: 'count',
    target_seconds: null,
    display_unit: null,
    sort_index: 0,
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    deleted_at: null,
    ...overrides,
  };
}

function makeStats(overrides: Partial<HabitStats> = {}): HabitStats {
  return {
    completion_count: 0,
    completion_history: [],
    skip_history: [],
    ...overrides,
  };
}

describe('habitStreak', () => {
  // Noon on 2026-06-12, local — the streak's "today".
  const now = new Date(2026, 5, 12, 12, 0, 0);

  it('counts consecutive completed days for a scheduled daily habit', () => {
    const habit = makeHabit();
    const stats = makeStats({
      completion_history: ['2026-06-12', '2026-06-11', '2026-06-10'],
    });
    expect(habitStreak(habit, stats, now)).toBe(3);
  });

  it('treats a skipped due-day as neutral, not a break', () => {
    const habit = makeHabit();
    // 6/11 was skipped (no completion) — the streak should bridge it.
    const stats = makeStats({
      completion_history: ['2026-06-12', '2026-06-10', '2026-06-09'],
      skip_history: ['2026-06-11'],
    });
    expect(habitStreak(habit, stats, now)).toBe(3);
  });

  it('is 0 when there is no completion history', () => {
    expect(habitStreak(makeHabit(), makeStats(), now)).toBe(0);
  });

  it('counts hit periods for a flex habit', () => {
    const habit = makeHabit({
      kind: 'flex',
      rrule: null,
      dtstart: null,
      target_count: 2,
      target_period: 'week',
    });
    // Two completions in each of the current and prior week (period starts).
    const stats = makeStats({
      completion_history: [
        '2026-06-08', '2026-06-08',
        '2026-06-01', '2026-06-01',
      ],
    });
    expect(habitStreak(habit, stats, now)).toBe(2);
  });
});
