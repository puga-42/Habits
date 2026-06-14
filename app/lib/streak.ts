// Streak — current "completions without missing", cadence-aware per habit kind.
// Pure and TDD'd; see __tests__/streak.test.ts. No network, no mocks.
//
// Streaks were a deliberate non-feature originally (see CONTEXT.md history);
// product reversed that on 2026-06-12. RRULE expansion is client-only in this
// codebase, so scheduled streaks are computed here, reusing `expandHabit`.
//
// A habit is a LINEAGE, not a single row: a "This and future" edit forks a new
// row sharing the lineage_id, with its own schedule era. The streak therefore
// spans SEGMENTS — one per lineage row — so the days before and after an edit
// form one continuous streak. (Flex never forks — flex edits use applyEditAll —
// so a flex lineage is always a single segment; the per-segment target logic is
// forward-looking.)

import { expandHabit } from './history';
import { isoDate, weekStart, type FlexPeriod, type Habit, type HabitKind } from './habits';

// One era of a lineage's schedule. For scheduled habits, rrule/dtstart/until
// drive occurrence expansion; for flex, target_count/target_period drive the
// per-period goal. dtstart bounds when this era begins.
export type ScheduleSegment = {
  rrule: string | null;
  dtstart: string | null;
  until: string | null;
  target_count: number | null;
  target_period: FlexPeriod | null;
};

// Everything the streak needs, lifted from a lineage + its completion history.
// `completion_dates` are occurrence_dates (scheduled) or period_starts (flex);
// `skip_dates` are scheduled `skip` override dates. Both are YYYY-MM-DD and may
// be capped by the caller (the feed RPC returns the most recent ~100) — a
// streak longer than the cap is under-reported, never over-reported.
export type StreakInput = {
  kind: HabitKind;
  segments: ScheduleSegment[];
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
  if (input.completion_dates.length === 0) return 0;

  const completed = new Set(input.completion_dates);
  const skipped = new Set(input.skip_dates);
  const todayIso = isoDate(now);
  const earliest = minString(input.completion_dates);
  const from = startOfLocalDay(parseIso(earliest));
  const to = endOfLocalDay(now);

  // Expand every era of the lineage over [earliest completed day .. end of
  // today] and union the occurrences. Each segment carries its own
  // rrule/dtstart/until, so a daily era and a later weekly era both contribute
  // their real occurrences — the fork's new dtstart no longer hides the past.
  const occSet = new Set<string>();
  for (const segment of input.segments) {
    if (!segment.rrule || !segment.dtstart) continue;
    const habitLike = {
      id: 'streak',
      kind: 'scheduled',
      rrule: segment.rrule,
      dtstart: segment.dtstart,
      until: segment.until,
    } as unknown as Habit;
    for (const d of expandHabit(habitLike, from, to)) {
      occSet.add(isoDate(d));
    }
  }

  const occIso = [...occSet].filter((d) => d <= todayIso).sort();

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
  if (input.completion_dates.length === 0) return 0;

  // Segments newest-first by start date so the first match for a period is the
  // latest era that had begun by then. A null dtstart sorts earliest.
  const segs = [...input.segments].sort((a, b) =>
    startDate(b).localeCompare(startDate(a)),
  );
  const activeAt = (periodStartIso: string): ScheduleSegment | undefined =>
    segs.find((s) => startDate(s) <= periodStartIso) ?? segs[segs.length - 1];

  const current = activeAt(isoDate(now));
  const period = current?.target_period;
  if (period == null) return 0;

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
    const seg = activeAt(cursor);
    const target = seg?.target_count;
    if (target == null || target <= 0) break;
    const hit = (counts.get(cursor) ?? 0) >= target;
    if (hit) {
      streak++;
    } else if (!isCurrent) {
      break; // a completed past period that missed target ends the streak
    }
    // else: in-progress current period not yet hit — neutral, keep walking.
    isCurrent = false;
    cursor = prevPeriodStart(cursor, seg?.target_period ?? period);
  }
  return streak;
}

// ─── Period helpers ──────────────────────────────────────────────────────────

// Date-only (YYYY-MM-DD) start of a segment; '' (sorts/compares earliest) when
// the era has no explicit start.
function startDate(s: ScheduleSegment): string {
  return s.dtstart ? s.dtstart.slice(0, 10) : '';
}

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
