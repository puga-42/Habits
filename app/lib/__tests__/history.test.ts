import {
  agendaDatesForMonth,
  buildDayGroups,
  buildMonthGrid,
  completionCountByDate,
  countCompletionsByDate,
  densityBucket,
  expandHabit,
  flexPeriodStartFor,
  flexProgressByHabit,
  isDayFuture,
  monthLabel,
  nDayRange,
  nextMonth,
  partitionRows,
  prevMonth,
  swipeActionsForRow,
  weekDatesFrom,
  type AgendaRow,
  type CompletionWithHabit,
  type DayGroup,
} from '../history';
import { isoDate, nextSortIndexFromList, type Habit, type HabitOverride } from '../habits';

// ─── Fixtures ──────────────────────────────────────────────────────────────

const meditate: Habit = {
  id: 'h-meditate',
  lineage_id: 'h-meditate',
  owner_id: 'u1',
  kind: 'scheduled',
  title: 'Meditate',
  description: null,
  icon: '🧘',
  color: '#0ABAB5',
  visibility: 'private',
  timezone: 'UTC',
  dtstart: '2026-05-01T07:00:00Z',
  rrule: 'FREQ=DAILY',
  until: null,
  target_count: null,
  target_period: null,
  unit: 'count',
  count_unit: null,
  target_seconds: null,
  display_unit: null,
  sort_index: 1,
  created_at: '2026-05-01T00:00:00Z',
  updated_at: '2026-05-01T00:00:00Z',
  deleted_at: null,
};

const gym: Habit = {
  ...meditate,
  id: 'h-gym',
  lineage_id: 'h-gym',
  title: 'Gym',
  icon: '🏋',
  color: '#10b981',
  kind: 'flex',
  dtstart: null,
  rrule: null,
  target_count: 3,
  target_period: 'week',
};

// Anchor `today` after every test fixture date so existing behavior tests run
// in "past" mode; new tests pick their own today explicitly.
const MAY_14 = new Date(2026, 4, 14);

function mkScheduled(
  id: string,
  habit: Habit,
  occurrenceDate: string,
  completedAt: string,
): CompletionWithHabit {
  return {
    id,
    habit_id: habit.id,
    owner_id: 'u1',
    occurrence_date: occurrenceDate,
    period_start: null,
    completed_at: completedAt,
    note: null,
    visibility_override: null,
    created_at: completedAt,
    updated_at: completedAt,
    habits: {
      id: habit.id,
      title: habit.title,
      icon: habit.icon,
      color: habit.color,
      kind: habit.kind,
      unit: habit.unit,
    },
  };
}

function mkFlex(
  id: string,
  habit: Habit,
  periodStart: string,
  completedAt: string,
): CompletionWithHabit {
  return {
    id,
    habit_id: habit.id,
    owner_id: 'u1',
    occurrence_date: null,
    period_start: periodStart,
    completed_at: completedAt,
    note: null,
    visibility_override: null,
    created_at: completedAt,
    updated_at: completedAt,
    habits: {
      id: habit.id,
      title: habit.title,
      icon: habit.icon,
      color: habit.color,
      kind: habit.kind,
      unit: habit.unit,
    },
  };
}

// ─── buildMonthGrid ────────────────────────────────────────────────────────

describe('buildMonthGrid', () => {
  it('returns 42 cells (6 weeks × 7 days)', () => {
    expect(buildMonthGrid(2026, 5).length).toBe(42);
  });

  it('first cell is a Sunday', () => {
    const grid = buildMonthGrid(2026, 5);
    expect(grid[0].date.getDay()).toBe(0);
  });

  it('marks cells inside the target month', () => {
    const grid = buildMonthGrid(2026, 5);
    const may15 = grid.find((c) => c.iso === '2026-05-15');
    expect(may15?.inMonth).toBe(true);
  });

  it('marks cells outside the target month as not inMonth', () => {
    const grid = buildMonthGrid(2026, 5);
    const apr30 = grid.find((c) => c.iso === '2026-04-30');
    expect(apr30?.inMonth).toBe(false);
  });

  it('marks future cells relative to today', () => {
    const grid = buildMonthGrid(2026, 5, new Date(2026, 4, 13));
    expect(grid.find((c) => c.iso === '2026-05-20')?.isFuture).toBe(true);
    expect(grid.find((c) => c.iso === '2026-05-10')?.isFuture).toBe(false);
  });

  it('marks today', () => {
    const grid = buildMonthGrid(2026, 5, new Date(2026, 4, 13));
    expect(grid.find((c) => c.iso === '2026-05-13')?.isToday).toBe(true);
  });

  it('handles December (year rolls into next month padding)', () => {
    const grid = buildMonthGrid(2026, 12);
    expect(grid.length).toBe(42);
    expect(grid.some((c) => c.iso.startsWith('2027-01-'))).toBe(true);
  });
});

// ─── prevMonth / nextMonth ─────────────────────────────────────────────────

describe('prevMonth', () => {
  it('rolls January back to December of prior year', () => {
    expect(prevMonth(2026, 1)).toEqual({ year: 2025, month: 12 });
  });
  it('decrements within a year', () => {
    expect(prevMonth(2026, 5)).toEqual({ year: 2026, month: 4 });
  });
});

describe('nextMonth', () => {
  it('rolls December forward to January of next year', () => {
    expect(nextMonth(2026, 12)).toEqual({ year: 2027, month: 1 });
  });
  it('increments within a year', () => {
    expect(nextMonth(2026, 5)).toEqual({ year: 2026, month: 6 });
  });
});

// ─── monthLabel ────────────────────────────────────────────────────────────

describe('monthLabel', () => {
  it('formats as "Month YYYY"', () => {
    expect(monthLabel(2026, 5)).toBe('May 2026');
    expect(monthLabel(2026, 12)).toBe('December 2026');
    expect(monthLabel(2025, 1)).toBe('January 2025');
  });
});

// ─── agendaDatesForMonth ───────────────────────────────────────────────────

describe('agendaDatesForMonth', () => {
  it('returns every day of the month, in order', () => {
    const days = agendaDatesForMonth(2026, 5);
    expect(days[0]).toBe('2026-05-01');
    expect(days[days.length - 1]).toBe('2026-05-31');
    expect(days.length).toBe(31);
  });

  it('handles February in a non-leap year (28 days)', () => {
    const days = agendaDatesForMonth(2025, 2);
    expect(days.length).toBe(28);
    expect(days[27]).toBe('2025-02-28');
  });

  it('handles February in a leap year (29 days)', () => {
    const days = agendaDatesForMonth(2028, 2);
    expect(days.length).toBe(29);
  });
});

// ─── expandHabit ───────────────────────────────────────────────────────────

describe('expandHabit', () => {
  it('returns empty for flex habits', () => {
    const from = new Date(2026, 4, 1);
    const to = new Date(2026, 4, 31);
    expect(expandHabit(gym, from, to)).toEqual([]);
  });

  it('returns empty for scheduled habits with no rrule', () => {
    const noRule: Habit = { ...meditate, rrule: null };
    const from = new Date(2026, 4, 1);
    const to = new Date(2026, 4, 31);
    expect(expandHabit(noRule, from, to)).toEqual([]);
  });

  it('expands a daily habit across a date range', () => {
    const from = new Date(2026, 4, 13);
    const to = new Date(2026, 4, 15, 23, 59, 59);
    const dates = expandHabit(meditate, from, to);
    expect(dates.map((d) => isoDate(d))).toEqual([
      '2026-05-13', '2026-05-14', '2026-05-15',
    ]);
  });

  it('respects the until cap on the habit', () => {
    const capped: Habit = {
      ...meditate,
      until: '2026-05-14T23:59:59Z',
    };
    const from = new Date(2026, 4, 13);
    const to = new Date(2026, 4, 20, 23, 59, 59);
    const dates = expandHabit(capped, from, to);
    expect(dates.map((d) => isoDate(d))).toEqual(['2026-05-13', '2026-05-14']);
  });
});

// ─── flexPeriodStartFor ────────────────────────────────────────────────────

describe('flexPeriodStartFor', () => {
  // Wed 2026-07-08. Monday-first week → Mon 2026-07-06. Month → 2026-07-01.
  it('returns the same day for a day-period habit', () => {
    expect(flexPeriodStartFor('2026-07-08', 'day')).toBe('2026-07-08');
  });

  it('returns the Monday of the week for a week-period habit', () => {
    expect(flexPeriodStartFor('2026-07-08', 'week')).toBe('2026-07-06');
  });

  it('returns the first of the month for a month-period habit', () => {
    expect(flexPeriodStartFor('2026-07-08', 'month')).toBe('2026-07-01');
  });
});

// ─── buildDayGroups: past-only behavior (existing) ─────────────────────────

describe('buildDayGroups (past)', () => {
  it('produces one group per day in range, in order', () => {
    const groups = buildDayGroups(
      ['2026-05-12', '2026-05-13'],
      [],
      [],
      [],
      MAY_14,
    );
    expect(groups.map((g) => g.date)).toEqual(['2026-05-12', '2026-05-13']);
  });

  it('groups scheduled completions by occurrence_date', () => {
    const completions = [
      mkScheduled('c1', meditate, '2026-05-12', '2026-05-12T07:00:00Z'),
      mkScheduled('c2', meditate, '2026-05-13', '2026-05-13T07:00:00Z'),
    ];
    const groups = buildDayGroups(
      ['2026-05-12', '2026-05-13'],
      [meditate],
      completions,
      [],
      MAY_14,
    );
    expect(groups[0].rows).toHaveLength(1);
    expect(groups[1].rows).toHaveLength(1);
  });

  it('emits a flex pill (not per-tap rows) for a flex completion on a past day', () => {
    const completion = mkFlex('c1', gym, '2026-05-11', '2026-05-13T18:30:00Z');
    const groups = buildDayGroups(
      ['2026-05-13'],
      [gym],
      [completion],
      [],
      MAY_14,
    );
    expect(groups[0].rows).toHaveLength(1);
    expect(groups[0].rows[0].kind).toBe('flex');
    if (groups[0].rows[0].kind === 'flex') {
      expect(groups[0].rows[0].count).toBe(1);
    }
  });

  it('applies an edit override to the displayed title/icon/color', () => {
    const completions = [
      mkScheduled('c1', meditate, '2026-05-13', '2026-05-13T07:00:00Z'),
    ];
    const overrides: HabitOverride[] = [
      {
        id: 'o1',
        habit_id: meditate.id,
        occurrence_date: '2026-05-13',
        kind: 'edit',
        patch: { title: 'Morning meditation', icon: '🧠', color: '#ef4444' },
        created_at: '2026-05-13T06:00:00Z',
      },
    ];
    const groups = buildDayGroups(
      ['2026-05-13'],
      [meditate],
      completions,
      overrides,
      MAY_14,
    );
    const row = groups[0].rows[0];
    if (row.kind === 'completion') {
      expect(row.habit.title).toBe('Morning meditation');
      expect(row.habit.icon).toBe('🧠');
      expect(row.habit.color).toBe('#ef4444');
    } else {
      throw new Error('expected completion row');
    }
  });

  it('inserts a rest row for skip overrides on a past day', () => {
    const overrides: HabitOverride[] = [
      {
        id: 'o1',
        habit_id: meditate.id,
        occurrence_date: '2026-05-13',
        kind: 'skip',
        patch: null,
        created_at: '2026-05-13T08:00:00Z',
      },
    ];
    const groups = buildDayGroups(
      ['2026-05-13'],
      [meditate],
      [],
      overrides,
      MAY_14,
    );
    expect(groups[0].rows[0].kind).toBe('rest');
  });

  it('shows scheduled rows for past days with no activity', () => {
    const groups = buildDayGroups(['2026-05-13'], [meditate], [], [], MAY_14);
    expect(groups[0].rows).toHaveLength(1);
    expect(groups[0].rows[0].kind).toBe('scheduled');
  });

  it('sorts rows within a day by time, earlier first', () => {
    const completions = [
      mkScheduled('c-late', meditate, '2026-05-13', '2026-05-13T18:00:00Z'),
      mkScheduled('c-early', meditate, '2026-05-13', '2026-05-13T07:00:00Z'),
    ];
    const groups = buildDayGroups(
      ['2026-05-13'],
      [meditate],
      completions,
      [],
      MAY_14,
    );
    expect(
      groups[0].rows.map((r) => (r.kind === 'completion' ? r.id : null)),
    ).toEqual(['c-early', 'c-late']);
  });

  it('omits rest rows whose habit is unknown', () => {
    const overrides: HabitOverride[] = [
      {
        id: 'o1',
        habit_id: 'h-missing',
        occurrence_date: '2026-05-13',
        kind: 'skip',
        patch: null,
        created_at: '2026-05-13T08:00:00Z',
      },
    ];
    const groups = buildDayGroups(['2026-05-13'], [], [], overrides, MAY_14);
    expect(groups[0].rows).toEqual([]);
  });
});

// ─── buildDayGroups: today + future behavior (new) ─────────────────────────

describe('buildDayGroups (today + future)', () => {
  const TODAY = new Date(2026, 4, 13); // May 13, 2026
  const todayIso = isoDate(TODAY);

  it('shows a scheduled row on today if no completion or skip', () => {
    const groups = buildDayGroups([todayIso], [meditate], [], [], TODAY);
    expect(groups[0].rows).toHaveLength(1);
    expect(groups[0].rows[0].kind).toBe('scheduled');
  });

  it('shows a completion row (not scheduled) when completion exists for today', () => {
    const c = mkScheduled('c1', meditate, todayIso, '2026-05-13T07:00:00Z');
    const groups = buildDayGroups([todayIso], [meditate], [c], [], TODAY);
    expect(groups[0].rows).toHaveLength(1);
    expect(groups[0].rows[0].kind).toBe('completion');
  });

  it('shows a rest row (not scheduled) when skip override exists for today', () => {
    const override: HabitOverride = {
      id: 'o1',
      habit_id: meditate.id,
      occurrence_date: todayIso,
      kind: 'skip',
      patch: null,
      created_at: '2026-05-13T08:00:00Z',
    };
    const groups = buildDayGroups([todayIso], [meditate], [], [override], TODAY);
    expect(groups[0].rows).toHaveLength(1);
    expect(groups[0].rows[0].kind).toBe('rest');
  });

  it('shows a scheduled row on a future day', () => {
    const futureIso = '2026-05-20';
    const groups = buildDayGroups([futureIso], [meditate], [], [], TODAY);
    expect(groups[0].rows).toHaveLength(1);
    expect(groups[0].rows[0].kind).toBe('scheduled');
  });

  it('shows a scheduled row on a past day with no completion', () => {
    // Today = May 13; date in range = May 10 (past). Habit is daily.
    const groups = buildDayGroups(['2026-05-10'], [meditate], [], [], TODAY);
    expect(groups[0].rows).toHaveLength(1);
    expect(groups[0].rows[0].kind).toBe('scheduled');
  });

  it('respects the habit until cap when expanding future occurrences', () => {
    const capped: Habit = {
      ...meditate,
      until: '2026-05-14T23:59:59Z',
    };
    const groups = buildDayGroups(
      ['2026-05-15', '2026-05-16'],
      [capped],
      [],
      [],
      TODAY,
    );
    expect(groups[0].rows).toEqual([]);
    expect(groups[1].rows).toEqual([]);
  });

  it('does NOT render flex completions as individual completion rows on today (only the flex pill)', () => {
    const completions = [
      mkFlex('c1', gym, '2026-05-11', '2026-05-13T08:00:00Z'),
      mkFlex('c2', gym, '2026-05-11', '2026-05-13T18:00:00Z'),
    ];
    const groups = buildDayGroups([todayIso], [gym], completions, [], TODAY);
    const completionRows = groups[0].rows.filter((r) => r.kind === 'completion');
    expect(completionRows).toEqual([]);
    const flexRow = groups[0].rows.find((r) => r.kind === 'flex');
    expect(flexRow).toBeDefined();
    if (flexRow && flexRow.kind === 'flex') {
      expect(flexRow.count).toBe(2);
    }
  });

  it('flex pill count keeps incrementing past target (over-achievement) with no extra rows', () => {
    const completions = [
      mkFlex('c1', gym, '2026-05-11', '2026-05-12T08:00:00Z'),
      mkFlex('c2', gym, '2026-05-11', '2026-05-12T18:00:00Z'),
      mkFlex('c3', gym, '2026-05-11', '2026-05-13T08:00:00Z'),
      mkFlex('c4', gym, '2026-05-11', '2026-05-13T12:00:00Z'),
      mkFlex('c5', gym, '2026-05-11', '2026-05-13T18:00:00Z'),
    ];
    const groups = buildDayGroups([todayIso], [gym], completions, [], TODAY);
    expect(groups[0].rows).toHaveLength(1);
    const row = groups[0].rows[0];
    expect(row.kind).toBe('flex');
    if (row.kind === 'flex') {
      expect(row.count).toBe(5);
      expect(row.target).toBe(3);
    }
  });
});

// ─── buildDayGroups: flex "log it" rows ────────────────────────────────────

describe('buildDayGroups (flex log-it rows)', () => {
  const TODAY = new Date(2026, 4, 13); // Wed May 13, 2026
  const todayIso = isoDate(TODAY);

  it('emits a flex row on today even when no completions exist (the bug fix)', () => {
    const groups = buildDayGroups([todayIso], [gym], [], [], TODAY);
    const flexRow = groups[0].rows.find((r) => r.kind === 'flex');
    expect(flexRow).toBeDefined();
    if (flexRow && flexRow.kind === 'flex') {
      expect(flexRow.habitId).toBe(gym.id);
      expect(flexRow.count).toBe(0);
      expect(flexRow.target).toBe(3);
      expect(flexRow.period).toBe('week');
    }
  });

  it('still emits a flex row after the target has been hit (over-achievement)', () => {
    // Three completions in the same week as TODAY (week of May 11).
    const completions = [
      mkFlex('c1', gym, '2026-05-11', '2026-05-11T18:00:00Z'),
      mkFlex('c2', gym, '2026-05-11', '2026-05-12T18:00:00Z'),
      mkFlex('c3', gym, '2026-05-11', '2026-05-13T08:00:00Z'),
    ];
    const groups = buildDayGroups([todayIso], [gym], completions, [], TODAY);
    const flexRow = groups[0].rows.find((r) => r.kind === 'flex');
    expect(flexRow).toBeDefined();
    if (flexRow && flexRow.kind === 'flex') {
      expect(flexRow.count).toBe(3);
      expect(flexRow.target).toBe(3);
    }
  });

  it('emits a flex row on a future day with the count for that day\'s containing period', () => {
    // Future day in the same week as TODAY → count includes earlier-in-week completion.
    const sameWeekFuture = '2026-05-15'; // Fri of week starting Mon May 11
    const completions = [
      mkFlex('c1', gym, '2026-05-11', '2026-05-12T18:00:00Z'),
    ];
    const groups = buildDayGroups([sameWeekFuture], [gym], completions, [], TODAY);
    const flexRow = groups[0].rows.find((r) => r.kind === 'flex');
    expect(flexRow).toBeDefined();
    if (flexRow && flexRow.kind === 'flex') {
      expect(flexRow.count).toBe(1);
    }
  });

  it('a future day in a later week shows count 0 (its own period has no completions)', () => {
    const nextWeekDay = '2026-05-20'; // Wed of next week
    const completions = [
      mkFlex('c1', gym, '2026-05-11', '2026-05-12T18:00:00Z'),
    ];
    const groups = buildDayGroups([nextWeekDay], [gym], completions, [], TODAY);
    const flexRow = groups[0].rows.find((r) => r.kind === 'flex');
    expect(flexRow).toBeDefined();
    if (flexRow && flexRow.kind === 'flex') {
      expect(flexRow.count).toBe(0);
    }
  });

  it('emits a flex row on a past day', () => {
    const pastIso = '2026-05-10';
    const groups = buildDayGroups([pastIso], [gym], [], [], TODAY);
    const flexRow = groups[0].rows.find((r) => r.kind === 'flex');
    expect(flexRow).toBeDefined();
    if (flexRow && flexRow.kind === 'flex') {
      expect(flexRow.habitId).toBe(gym.id);
      expect(flexRow.count).toBe(0);
      expect(flexRow.target).toBe(3);
    }
  });

  it('skips flex habits missing target_count or target_period', () => {
    const broken: Habit = { ...gym, target_count: null };
    const groups = buildDayGroups([todayIso], [broken], [], [], TODAY);
    expect(groups[0].rows.find((r) => r.kind === 'flex')).toBeUndefined();
  });

  it('a daily flex row counts only that exact day\'s completions', () => {
    const dailyHydrate: Habit = {
      ...gym,
      id: 'h-hydrate',
      lineage_id: 'h-hydrate',
      target_count: 8,
      target_period: 'day',
    };
    const completions = [
      mkFlex('c1', dailyHydrate, todayIso, '2026-05-13T09:00:00Z'),
      mkFlex('c2', dailyHydrate, todayIso, '2026-05-13T11:00:00Z'),
      // Yesterday's completion shouldn't count toward today.
      mkFlex('c3', dailyHydrate, '2026-05-12', '2026-05-12T09:00:00Z'),
    ];
    const groups = buildDayGroups(
      [todayIso],
      [dailyHydrate],
      completions,
      [],
      TODAY,
    );
    const flexRow = groups[0].rows.find((r) => r.kind === 'flex');
    expect(flexRow).toBeDefined();
    if (flexRow && flexRow.kind === 'flex') {
      expect(flexRow.count).toBe(2);
      expect(flexRow.period).toBe('day');
    }
  });

  it('partitionRows places flex rows in the not-completed bucket', () => {
    const completions = [
      mkFlex('c1', gym, '2026-05-11', '2026-05-12T18:00:00Z'),
    ];
    const groups = buildDayGroups([todayIso], [gym], completions, [], TODAY);
    const habitMap = new Map([[gym.id, gym]]);
    const { notCompleted, completed } = partitionRows(groups[0].rows, habitMap);
    expect(notCompleted.some((r) => r.kind === 'flex')).toBe(true);
    expect(completed.some((r) => r.kind === 'flex')).toBe(false);
  });
});

// ─── completionCountByDate ─────────────────────────────────────────────────

describe('completionCountByDate', () => {
  const fakeAgendaHabit = {
    id: 'h',
    title: 'H',
    description: null,
    icon: null,
    color: null,
    unit: 'count' as const,
  };

  function completionRow(id: string): AgendaRow {
    return {
      kind: 'completion',
      id,
      habit: fakeAgendaHabit,
      time: null,
      isFlex: false,
    };
  }
  function restRow(): AgendaRow {
    return {
      kind: 'rest',
      habitId: 'h',
      habit: fakeAgendaHabit,
      time: null,
      completed: false,
      completionId: null,
    };
  }
  function scheduledRow(): AgendaRow {
    return { kind: 'scheduled', habitId: 'h', habit: fakeAgendaHabit, time: null };
  }
  function group(date: string, rows: AgendaRow[]): DayGroup {
    return { date, rows };
  }

  it('returns empty for empty input', () => {
    expect(completionCountByDate([]).size).toBe(0);
  });

  it('counts only completion rows, ignoring rest and scheduled', () => {
    const map = completionCountByDate([
      group('2026-05-13', [completionRow('c1'), restRow(), scheduledRow()]),
    ]);
    expect(map.get('2026-05-13')).toBe(1);
  });

  it('sums multiple completions on the same day', () => {
    const map = completionCountByDate([
      group('2026-05-13', [completionRow('c1'), completionRow('c2')]),
    ]);
    expect(map.get('2026-05-13')).toBe(2);
  });

  it('omits days with zero completions from the map', () => {
    const map = completionCountByDate([group('2026-05-13', [restRow()])]);
    expect(map.has('2026-05-13')).toBe(false);
  });

  it('handles multiple days independently', () => {
    const map = completionCountByDate([
      group('2026-05-12', [completionRow('c1')]),
      group('2026-05-13', [completionRow('c2'), completionRow('c3')]),
      group('2026-05-14', []),
    ]);
    expect(map.get('2026-05-12')).toBe(1);
    expect(map.get('2026-05-13')).toBe(2);
    expect(map.has('2026-05-14')).toBe(false);
  });
});

// ─── countCompletionsByDate ────────────────────────────────────────────────

describe('countCompletionsByDate', () => {
  function comp(
    overrides: Partial<CompletionWithHabit> & {
      occurrence_date?: string | null;
      completed_at?: string;
    },
  ): CompletionWithHabit {
    return {
      id: overrides.id ?? 'c-' + Math.random(),
      habit_id: 'h-test',
      owner_id: 'u1',
      occurrence_date: overrides.occurrence_date ?? null,
      period_start: null,
      completed_at: overrides.completed_at ?? '2026-05-13T10:00:00Z',
      note: null,
      visibility_override: null,
      created_at: '2026-05-13T10:00:00Z',
      updated_at: '2026-05-13T10:00:00Z',
      habits: { id: 'h-test', title: 'Test', icon: null, color: null, kind: 'scheduled' },
      ...overrides,
    } as CompletionWithHabit;
  }

  it('returns empty for empty input', () => {
    expect(countCompletionsByDate([]).size).toBe(0);
  });

  it('buckets a scheduled completion by occurrence_date', () => {
    const map = countCompletionsByDate([comp({ occurrence_date: '2026-05-13' })]);
    expect(map.get('2026-05-13')).toBe(1);
  });

  it('buckets a flex completion (no occurrence_date) by local date of completed_at', () => {
    // 2026-05-13 at 10:00 UTC → still 2026-05-13 in most local zones; the
    // local-date conversion is what the function performs.
    const c = comp({
      occurrence_date: null,
      completed_at: new Date(2026, 4, 13, 10, 0).toISOString(),
    });
    const map = countCompletionsByDate([c]);
    expect(map.get('2026-05-13')).toBe(1);
  });

  it('sums multiple completions on the same date', () => {
    const map = countCompletionsByDate([
      comp({ id: 'c1', occurrence_date: '2026-05-13' }),
      comp({ id: 'c2', occurrence_date: '2026-05-13' }),
    ]);
    expect(map.get('2026-05-13')).toBe(2);
  });

  it('keeps separate counts per date', () => {
    const map = countCompletionsByDate([
      comp({ id: 'c1', occurrence_date: '2026-05-12' }),
      comp({ id: 'c2', occurrence_date: '2026-05-13' }),
      comp({ id: 'c3', occurrence_date: '2026-05-13' }),
    ]);
    expect(map.get('2026-05-12')).toBe(1);
    expect(map.get('2026-05-13')).toBe(2);
  });

  it('tallies minimal rows without a habits join (count-only query path)', () => {
    // fetchCompletionCountsByDate selects only the two date columns, so the
    // tally must work on rows lacking habit/id/owner fields.
    const map = countCompletionsByDate([
      { occurrence_date: '2026-05-13', completed_at: '2026-05-13T10:00:00Z' },
      { occurrence_date: '2026-05-13', completed_at: '2026-05-13T11:00:00Z' },
      { occurrence_date: null, completed_at: new Date(2026, 4, 14, 9).toISOString() },
    ]);
    expect(map.get('2026-05-13')).toBe(2);
    expect(map.get('2026-05-14')).toBe(1);
  });
});

// ─── flexProgressByHabit ───────────────────────────────────────────────────

describe('flexProgressByHabit', () => {
  // 2026-05-14 is a Thursday. The Monday of that week is 2026-05-11.
  const TODAY = new Date(2026, 4, 14);

  function flexHabit(
    overrides: Partial<Habit> & {
      id: string;
      target_count: number;
      target_period: 'day' | 'week' | 'month';
    },
  ): Habit {
    return {
      lineage_id: overrides.id,
      owner_id: 'u1',
      kind: 'flex',
      title: overrides.id,
      description: null,
      color: null,
      icon: null,
      visibility: 'private',
      timezone: 'UTC',
      dtstart: null,
      rrule: null,
      until: null,
      sort_index: 1,
      created_at: '2026-05-01T00:00:00Z',
      updated_at: '2026-05-01T00:00:00Z',
      deleted_at: null,
      ...overrides,
    } as Habit;
  }

  function comp(habit_id: string, period_start: string): CompletionWithHabit {
    return {
      id: 'c-' + Math.random(),
      habit_id,
      owner_id: 'u1',
      occurrence_date: null,
      period_start,
      completed_at: period_start + 'T00:00:00Z',
      note: null,
      visibility_override: null,
      created_at: '2026-05-13T10:00:00Z',
      updated_at: '2026-05-13T10:00:00Z',
      habits: { id: habit_id, title: habit_id, icon: null, color: null, kind: 'flex' },
    } as CompletionWithHabit;
  }

  it('returns empty map when no flex habits', () => {
    const scheduled = flexHabit({
      id: 'h-sched',
      target_count: 1,
      target_period: 'day',
    });
    scheduled.kind = 'scheduled';
    expect(flexProgressByHabit([scheduled], [], TODAY).size).toBe(0);
  });

  it('counts completions in the current week for a weekly flex habit', () => {
    const gym = flexHabit({ id: 'h-gym', target_count: 3, target_period: 'week' });
    const completions = [
      comp('h-gym', '2026-05-11'), // this week's Monday
      comp('h-gym', '2026-05-11'), // also this week
    ];
    const map = flexProgressByHabit([gym], completions, TODAY);
    expect(map.get('h-gym')).toEqual({ count: 2, target: 3 });
  });

  it('ignores completions outside the current week for a weekly flex habit', () => {
    const gym = flexHabit({ id: 'h-gym', target_count: 3, target_period: 'week' });
    const completions = [
      comp('h-gym', '2026-05-04'), // last week
      comp('h-gym', '2026-05-11'), // this week
    ];
    const map = flexProgressByHabit([gym], completions, TODAY);
    expect(map.get('h-gym')).toEqual({ count: 1, target: 3 });
  });

  it('counts only todays completions for a daily flex habit', () => {
    const water = flexHabit({ id: 'h-water', target_count: 8, target_period: 'day' });
    const completions = [
      comp('h-water', '2026-05-14'),
      comp('h-water', '2026-05-14'),
      comp('h-water', '2026-05-13'), // yesterday — ignored
    ];
    const map = flexProgressByHabit([water], completions, TODAY);
    expect(map.get('h-water')).toEqual({ count: 2, target: 8 });
  });

  it('counts completions in the current month for a monthly flex habit', () => {
    const learn = flexHabit({
      id: 'h-learn',
      target_count: 10,
      target_period: 'month',
    });
    // period_start is the *start of the period* (first of the month), not the
    // day the completion happened. Two May completions both bucket to 2026-05-01.
    const completions = [
      comp('h-learn', '2026-05-01'),
      comp('h-learn', '2026-05-01'),
      comp('h-learn', '2026-04-01'), // last month — ignored
    ];
    const map = flexProgressByHabit([learn], completions, TODAY);
    expect(map.get('h-learn')).toEqual({ count: 2, target: 10 });
  });

  it('keeps per-habit counts independent', () => {
    const gym = flexHabit({ id: 'h-gym', target_count: 3, target_period: 'week' });
    const water = flexHabit({ id: 'h-water', target_count: 8, target_period: 'day' });
    const completions = [
      comp('h-gym', '2026-05-11'),
      comp('h-water', '2026-05-14'),
      comp('h-water', '2026-05-14'),
    ];
    const map = flexProgressByHabit([gym, water], completions, TODAY);
    expect(map.get('h-gym')).toEqual({ count: 1, target: 3 });
    expect(map.get('h-water')).toEqual({ count: 2, target: 8 });
  });

  it('skips flex habits missing target_count or target_period', () => {
    const malformed = flexHabit({
      id: 'h-bad',
      target_count: 0,
      target_period: 'week',
    });
    malformed.target_count = null;
    expect(flexProgressByHabit([malformed], [], TODAY).size).toBe(0);
  });

  it('reports zero count when no completions match the current period', () => {
    const gym = flexHabit({ id: 'h-gym', target_count: 3, target_period: 'week' });
    const map = flexProgressByHabit([gym], [], TODAY);
    expect(map.get('h-gym')).toEqual({ count: 0, target: 3 });
  });
});

// ─── nDayRange ─────────────────────────────────────────────────────────────

describe('nDayRange', () => {
  it('returns n consecutive ISO dates starting at the anchor', () => {
    const anchor = new Date(2026, 4, 13);
    expect(nDayRange(anchor, 3)).toEqual([
      '2026-05-13',
      '2026-05-14',
      '2026-05-15',
    ]);
  });

  it('handles month rollover', () => {
    const anchor = new Date(2026, 4, 30);
    expect(nDayRange(anchor, 3)).toEqual([
      '2026-05-30',
      '2026-05-31',
      '2026-06-01',
    ]);
  });

  it('handles year rollover', () => {
    const anchor = new Date(2026, 11, 31);
    expect(nDayRange(anchor, 2)).toEqual(['2026-12-31', '2027-01-01']);
  });

  it('returns empty array for n=0', () => {
    expect(nDayRange(new Date(2026, 4, 13), 0)).toEqual([]);
  });
});

// ─── weekDatesFrom ─────────────────────────────────────────────────────────

describe('weekDatesFrom', () => {
  it('returns 7 dates with Sunday as week-start when anchor is mid-week', () => {
    const anchor = new Date(2026, 4, 13); // Wednesday May 13
    expect(weekDatesFrom(anchor, 0)).toEqual([
      '2026-05-10',
      '2026-05-11',
      '2026-05-12',
      '2026-05-13',
      '2026-05-14',
      '2026-05-15',
      '2026-05-16',
    ]);
  });

  it('rolls week to Monday-start', () => {
    const anchor = new Date(2026, 4, 13); // Wed
    expect(weekDatesFrom(anchor, 1)).toEqual([
      '2026-05-11',
      '2026-05-12',
      '2026-05-13',
      '2026-05-14',
      '2026-05-15',
      '2026-05-16',
      '2026-05-17',
    ]);
  });

  it('handles weekStart later in the week than the anchor', () => {
    const anchor = new Date(2026, 4, 13); // Wed (getDay=3)
    // weekStart=Thu (4): shift = 3-4 = -1 → +7 = 6 → start = anchor - 6 = Thu May 7
    expect(weekDatesFrom(anchor, 4)).toEqual([
      '2026-05-07',
      '2026-05-08',
      '2026-05-09',
      '2026-05-10',
      '2026-05-11',
      '2026-05-12',
      '2026-05-13',
    ]);
  });

  it('returns the anchor as the first date when anchor matches weekStart', () => {
    const anchor = new Date(2026, 4, 17); // Sunday May 17
    expect(weekDatesFrom(anchor, 0)[0]).toBe('2026-05-17');
  });
});

// ─── densityBucket ─────────────────────────────────────────────────────────

// ─── partitionRows ─────────────────────────────────────────────────────────

describe('partitionRows', () => {
  function makeHabit(id: string, sortIndex: number): Habit {
    return {
      id,
      lineage_id: id,
      owner_id: 'u1',
      kind: 'scheduled',
      title: id,
      description: null,
      icon: null,
      color: null,
      visibility: 'private',
      timezone: 'UTC',
      dtstart: '2026-05-01T00:00:00Z',
      rrule: 'FREQ=DAILY',
      until: null,
      target_count: null,
      target_period: null,
      unit: 'count',
      count_unit: null,
      target_seconds: null,
      display_unit: null,
      sort_index: sortIndex,
      created_at: '2026-05-01T00:00:00Z',
      updated_at: '2026-05-01T00:00:00Z',
      deleted_at: null,
    };
  }
  const h1 = makeHabit('h1', 1);
  const h2 = makeHabit('h2', 2);
  const h3 = makeHabit('h3', 3);
  const habitMap = new Map([h1, h2, h3].map((h) => [h.id, h] as const));

  function completion(habitId: string): AgendaRow {
    return {
      kind: 'completion',
      id: 'c-' + habitId,
      habit: { id: habitId, title: habitId, description: null, icon: null, color: null, unit: 'count' as const },
      time: null,
      isFlex: false,
    };
  }
  function scheduled(habitId: string): AgendaRow {
    return {
      kind: 'scheduled',
      habitId,
      habit: { id: habitId, title: habitId, description: null, icon: null, color: null, unit: 'count' as const },
      time: null,
    };
  }
  function rest(habitId: string): AgendaRow {
    return {
      kind: 'rest',
      habitId,
      habit: { id: habitId, title: habitId, description: null, icon: null, color: null, unit: 'count' as const },
      time: null,
      completed: false,
      completionId: null,
    };
  }

  it('puts completion rows in the completed bucket', () => {
    const out = partitionRows([completion('h1')], habitMap);
    expect(out.completed).toHaveLength(1);
    expect(out.notCompleted).toEqual([]);
  });

  it('puts scheduled rows in the notCompleted bucket', () => {
    const out = partitionRows([scheduled('h1')], habitMap);
    expect(out.notCompleted).toHaveLength(1);
    expect(out.completed).toEqual([]);
  });

  it('puts rest rows in the resting bucket', () => {
    const out = partitionRows([rest('h1')], habitMap);
    expect(out.resting).toHaveLength(1);
    expect(out.notCompleted).toEqual([]);
    expect(out.completed).toEqual([]);
  });

  it("sorts each bucket by the habit's sort_index ASC", () => {
    const out = partitionRows(
      [scheduled('h3'), scheduled('h1'), scheduled('h2')],
      habitMap,
    );
    expect(out.notCompleted.map((r) => (r.kind === 'scheduled' ? r.habitId : null))).toEqual([
      'h1',
      'h2',
      'h3',
    ]);
  });

  it('sorts completion rows by sort_index too', () => {
    const out = partitionRows(
      [completion('h3'), completion('h1'), completion('h2')],
      habitMap,
    );
    expect(out.completed.map((r) => (r.kind === 'completion' ? r.habit.id : null))).toEqual([
      'h1',
      'h2',
      'h3',
    ]);
  });

  it('returns all empty for no rows', () => {
    const out = partitionRows([], habitMap);
    expect(out).toEqual({ notCompleted: [], completed: [], resting: [] });
  });
});

// ─── nextSortIndexFromList ─────────────────────────────────────────────────

describe('nextSortIndexFromList', () => {
  it('returns 1 for an empty list', () => {
    expect(nextSortIndexFromList([])).toBe(1);
  });
  it('returns max + 1', () => {
    expect(nextSortIndexFromList([0, 1, 5])).toBe(6);
    expect(nextSortIndexFromList([10])).toBe(11);
  });
  it('handles negative entries', () => {
    expect(nextSortIndexFromList([-2, -1, 0])).toBe(1);
  });
});

// ─── densityBucket ─────────────────────────────────────────────────────────

describe('densityBucket', () => {
  it('maps 0 to bucket 0', () => {
    expect(densityBucket(0)).toBe(0);
  });
  it('maps 1 to bucket 1', () => {
    expect(densityBucket(1)).toBe(1);
  });
  it('maps 2 to bucket 2', () => {
    expect(densityBucket(2)).toBe(2);
  });
  it('maps 3 to bucket 3', () => {
    expect(densityBucket(3)).toBe(3);
  });
  it('maps 4 to bucket 4', () => {
    expect(densityBucket(4)).toBe(4);
  });
  it('caps 5+ at bucket 4', () => {
    expect(densityBucket(5)).toBe(4);
    expect(densityBucket(10)).toBe(4);
    expect(densityBucket(100)).toBe(4);
  });
  it('treats negative counts as 0', () => {
    expect(densityBucket(-1)).toBe(0);
  });
});

// ─── swipeActionsForRow ───────────────────────────────────────────────────

describe('swipeActionsForRow', () => {
  const habit = { id: 'h1', title: 'H', description: null, icon: null, color: null, unit: 'count' as const };

  it('returns [rest] for a scheduled (open) row', () => {
    const row: AgendaRow = { kind: 'scheduled', habitId: 'h1', habit, time: null };
    expect(swipeActionsForRow(row)).toEqual(['rest']);
  });

  it('returns [reset] for a completed scheduled row', () => {
    const row: AgendaRow = { kind: 'completion', id: 'c1', habit, time: null, isFlex: false };
    expect(swipeActionsForRow(row)).toEqual(['reset']);
  });

  it('returns [reset] for a completed flex row (isFlex completion)', () => {
    const row: AgendaRow = { kind: 'completion', id: 'c1', habit, time: null, isFlex: true };
    expect(swipeActionsForRow(row)).toEqual(['reset']);
  });

  it('returns [wake] for a resting row', () => {
    const row: AgendaRow = {
      kind: 'rest', habitId: 'h1', habit, time: null,
      completed: false, completionId: null,
    };
    expect(swipeActionsForRow(row)).toEqual(['wake']);
  });

  it('returns [reset] for a flex row with count > 0', () => {
    const row: AgendaRow = {
      kind: 'flex', habitId: 'h1', habit, time: null,
      period: 'week', count: 2, target: 3,
    };
    expect(swipeActionsForRow(row)).toEqual(['reset']);
  });

  it('returns [reset] for a flex row at target (full ring)', () => {
    const row: AgendaRow = {
      kind: 'flex', habitId: 'h1', habit, time: null,
      period: 'week', count: 3, target: 3,
    };
    expect(swipeActionsForRow(row)).toEqual(['reset']);
  });

  it('returns [] for a flex row with count 0', () => {
    const row: AgendaRow = {
      kind: 'flex', habitId: 'h1', habit, time: null,
      period: 'week', count: 0, target: 3,
    };
    expect(swipeActionsForRow(row)).toEqual([]);
  });

  it('returns [reset, rest] for a scheduled time-based row with progress', () => {
    const timeHabit = { ...habit, unit: 'time' as const };
    const row: AgendaRow = { kind: 'scheduled', habitId: 'h1', habit: timeHabit, time: null };
    expect(swipeActionsForRow(row, { timeProgress: 0.5 })).toEqual(['reset', 'rest']);
  });

  it('returns [rest] for a scheduled time-based row with no progress', () => {
    const timeHabit = { ...habit, unit: 'time' as const };
    const row: AgendaRow = { kind: 'scheduled', habitId: 'h1', habit: timeHabit, time: null };
    expect(swipeActionsForRow(row, { timeProgress: 0 })).toEqual(['rest']);
  });

  it('returns [rest] for a scheduled time-based row without opts', () => {
    const timeHabit = { ...habit, unit: 'time' as const };
    const row: AgendaRow = { kind: 'scheduled', habitId: 'h1', habit: timeHabit, time: null };
    expect(swipeActionsForRow(row)).toEqual(['rest']);
  });
});

// ─── isDayFuture ──────────────────────────────────────────────────────────

describe('isDayFuture', () => {
  it('returns false for a past date', () => {
    expect(isDayFuture('2026-06-01', '2026-06-09')).toBe(false);
  });

  it('returns false for today', () => {
    expect(isDayFuture('2026-06-09', '2026-06-09')).toBe(false);
  });

  it('returns true for tomorrow', () => {
    expect(isDayFuture('2026-06-10', '2026-06-09')).toBe(true);
  });

  it('returns true for a far-future date', () => {
    expect(isDayFuture('2027-01-01', '2026-06-09')).toBe(true);
  });
});
