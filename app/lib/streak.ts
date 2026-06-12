// Streak — current "completions without missing", cadence-aware per habit kind.
// Pure and TDD'd; see __tests__/streak.test.ts. No network, no mocks.
//
// Streaks were a deliberate non-feature originally (see CONTEXT.md history);
// product reversed that on 2026-06-12. RRULE expansion is client-only in this
// codebase, so scheduled streaks are computed here, reusing `expandHabit`.

import { expandHabit } from './history';
import { isoDate, weekStart, type FlexPeriod, type Habit, type HabitKind } from './habits';

// Everything the streak needs, lifted from a habit + its completion history.
// `completion_dates` are occurrence_dates (scheduled) or period_starts (flex);
// `skip_dates` are scheduled `skip` override dates. Both are YYYY-MM-DD and may
// be capped by the caller (the feed RPC returns the most recent ~100) — a
// streak longer than the cap is under-reported, never over-reported.
export type StreakInput = {
  kind: HabitKind;
  rrule: string | null;
  dtstart: string | null;
  until: string | null;
  target_count: number | null;
  target_period: FlexPeriod | null;
  completion_dates: string[];
  skip_dates: string[];
};

export function computeStreak(input: StreakInput, now: Date): number {
  return input.kind === 'flex'
    ? flexStreak(input, now)
    : scheduledStreak(input, now);
}

// ─── Scheduled ─────────────────────────────────────────────────────────────

function scheduledStreak(input: StreakInput, now: Date): number {
  if (!input.rrule || !input.dtstart) return 0;
  if (input.completion_dates.length === 0) return 0;

  const completed = new Set(input.completion_dates);
  const skipped = new Set(input.skip_dates);
  const todayIso = isoDate(now);
  const earliest = minString(input.completion_dates);

  // Expand occurrences over [earliest completed day .. end of today]. A minimal
  // habit shape is enough — expandHabit only reads kind/rrule/dtstart/until.
  const habitLike = {
    id: 'streak',
    kind: 'scheduled',
    rrule: input.rrule,
    dtstart: input.dtstart,
    until: input.until,
  } as unknown as Habit;
  const occurrences = expandHabit(
    habitLike,
    startOfLocalDay(parseIso(earliest)),
    endOfLocalDay(now),
  );

  const occIso = occurrences
    .map((d) => isoDate(d))
    .filter((d) => d <= todayIso);

  let streak = 0;
  for (let i = occIso.length - 1; i >= 0; i--) {
    const d = occIso[i];
    if (completed.has(d)) {
      streak++;
      continue;
    }
    if (skipped.has(d)) continue; // explicit skip — neutral
    if (d === todayIso) continue; // today isn't over yet — neutral
    break; // a genuine miss ends the streak
  }
  return streak;
}

// ─── Flex ──────────────────────────────────────────────────────────────────

function flexStreak(input: StreakInput, now: Date): number {
  const target = input.target_count;
  const period = input.target_period;
  if (target == null || target <= 0 || period == null) return 0;
  if (input.completion_dates.length === 0) return 0;

  const counts = new Map<string, number>();
  for (const d of input.completion_dates) {
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  const earliest = minString(input.completion_dates);

  let streak = 0;
  let cursor = currentPeriodStart(now, period);
  let isCurrent = true;
  // Bounded walk back through period buckets until before the first completion.
  for (let guard = 0; guard < 4000 && cursor >= earliest; guard++) {
    const hit = (counts.get(cursor) ?? 0) >= target;
    if (hit) {
      streak++;
    } else if (!isCurrent) {
      break; // a completed past period that missed target ends the streak
    }
    // else: in-progress current period not yet hit — neutral, keep walking.
    isCurrent = false;
    cursor = prevPeriodStart(cursor, period);
  }
  return streak;
}

// ─── Period helpers ──────────────────────────────────────────────────────────

function currentPeriodStart(now: Date, period: FlexPeriod): string {
  if (period === 'day') return isoDate(now);
  if (period === 'week') return isoDate(weekStart(now));
  return isoDate(new Date(now.getFullYear(), now.getMonth(), 1));
}

function prevPeriodStart(iso: string, period: FlexPeriod): string {
  const d = parseIso(iso);
  if (period === 'day') {
    d.setDate(d.getDate() - 1);
    return isoDate(d);
  }
  if (period === 'week') {
    d.setDate(d.getDate() - 7);
    return isoDate(weekStart(d));
  }
  return isoDate(new Date(d.getFullYear(), d.getMonth() - 1, 1));
}

// ─── Date utilities ──────────────────────────────────────────────────────────

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d);
}

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function minString(values: string[]): string {
  let min = values[0];
  for (const v of values) if (v < min) min = v;
  return min;
}
