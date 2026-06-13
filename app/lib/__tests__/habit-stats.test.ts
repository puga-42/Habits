import { habitStreak, streaksByHabit, type HabitStats } from '../habit-stats';
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

describe('streaksByHabit', () => {
  const now = new Date(2026, 5, 12, 12, 0, 0);
  type LineageStats = { completion_history: string[]; skip_history: string[] };

  it('maps each habit id to its lineage streak', () => {
    const a = makeHabit({ id: 'a', lineage_id: 'lin-a' });
    const b = makeHabit({ id: 'b', lineage_id: 'lin-b' });
    const stats = new Map<string, LineageStats>([
      ['lin-a', { completion_history: ['2026-06-12', '2026-06-11', '2026-06-10'], skip_history: [] }],
      ['lin-b', { completion_history: ['2026-06-12'], skip_history: [] }],
    ]);

    const result = streaksByHabit([a, b], stats, now);
    expect(result.get('a')).toBe(3);
    expect(result.get('b')).toBe(1);
  });

  it('looks up stats by lineage_id, not habit id', () => {
    // A habit whose id differs from its lineage (e.g. an edited later version).
    const h = makeHabit({ id: 'v2', lineage_id: 'lin' });
    const stats = new Map<string, LineageStats>([
      ['lin', { completion_history: ['2026-06-12', '2026-06-11'], skip_history: [] }],
    ]);
    expect(streaksByHabit([h], stats, now).get('v2')).toBe(2);
  });

  it('yields 0 for a habit whose lineage has no stats entry', () => {
    const h = makeHabit({ id: 'a', lineage_id: 'lin-missing' });
    const result = streaksByHabit([h], new Map(), now);
    expect(result.get('a')).toBe(0);
  });
});
