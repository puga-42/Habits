// History — queries and pure functions for the calendar + agenda surface.
// Pure functions are TDD'd; see __tests__/history.test.ts.
// No streaks, no completion rates, ever (see CONTEXT.md).

import { rrulestr } from 'rrule';

import { supabase } from './supabase';
import {
  isoDate,
  type Completion,
  type Habit,
  type HabitKind,
  type HabitOverride,
  type OccurrencePatch,
} from './habits';

// ─── Types ─────────────────────────────────────────────────────────────────

export type MonthCell = {
  date: Date;
  iso: string;       // YYYY-MM-DD (local)
  inMonth: boolean;  // is this cell in the displayed month
  isFuture: boolean; // strictly after `today`
  isToday: boolean;
};

// A `habit_completions` row joined to its parent habit's display fields.
export type CompletionWithHabit = Completion & {
  habits: {
    id: string;
    title: string;
    icon: string | null;
    color: string | null;
    kind: HabitKind;
  };
};

type AgendaHabit = {
  id: string;
  title: string;
  icon: string | null;
  color: string | null;
};

export type AgendaRow =
  | {
      kind: 'completion';
      id: string;
      habit: AgendaHabit;
      time: Date | null;
      isFlex: boolean;
    }
  | {
      kind: 'scheduled';
      habitId: string;
      habit: AgendaHabit;
      time: Date | null;
    }
  | {
      kind: 'skip';
      habitId: string;
      habit: AgendaHabit;
      time: Date | null;
    };

export type DayGroup = {
  date: string; // YYYY-MM-DD
  rows: AgendaRow[];
};

// ─── Month grid + navigation ───────────────────────────────────────────────

export function buildMonthGrid(
  year: number,
  month: number, // 1-12
  today: Date = new Date(),
): MonthCell[] {
  const firstOfMonth = new Date(year, month - 1, 1);
  const dayOfWeek = firstOfMonth.getDay(); // 0 = Sunday
  const start = new Date(year, month - 1, 1 - dayOfWeek);
  const todayIso = isoDate(today);

  const cells: MonthCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const iso = isoDate(d);
    cells.push({
      date: d,
      iso,
      inMonth: d.getMonth() === month - 1 && d.getFullYear() === year,
      isFuture: iso > todayIso,
      isToday: iso === todayIso,
    });
  }
  return cells;
}

export function prevMonth(year: number, month: number) {
  return month === 1
    ? { year: year - 1, month: 12 }
    : { year, month: month - 1 };
}

export function nextMonth(year: number, month: number) {
  return month === 12
    ? { year: year + 1, month: 1 }
    : { year, month: month + 1 };
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

// Every day in the visible month, in chronological order.
export function agendaDatesForMonth(year: number, month: number): string[] {
  const out: string[] = [];
  for (let d = 1; d <= 31; d++) {
    const date = new Date(year, month - 1, d);
    if (date.getMonth() !== month - 1) break; // past end of month
    out.push(isoDate(date));
  }
  return out;
}

// ─── RRULE expansion ──────────────────────────────────────────────────────

// Format a Date as RFC 5545 UTC date-time (YYYYMMDDTHHMMSSZ) for RRULE UNTIL.
function formatRruleUntil(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
}

// Expand a scheduled habit's RRULE within [from, to] (inclusive). Respects
// the habit's `until` column. Returns empty for flex habits and for malformed
// rules.
export function expandHabit(habit: Habit, from: Date, to: Date): Date[] {
  if (habit.kind !== 'scheduled' || !habit.rrule || !habit.dtstart) return [];
  let ruleStr = habit.rrule;
  if (habit.until) {
    ruleStr += `;UNTIL=${formatRruleUntil(new Date(habit.until))}`;
  }
  try {
    const rule = rrulestr(ruleStr, { dtstart: new Date(habit.dtstart) });
    return rule.between(from, to, true);
  } catch (err) {
    console.warn('RRULE parse failed for habit', habit.id, err);
    return [];
  }
}

// ─── Day-group construction ────────────────────────────────────────────────

export function buildDayGroups(
  daysInRange: string[],
  habits: Habit[],
  completions: CompletionWithHabit[],
  overrides: HabitOverride[],
  today: Date = new Date(),
): DayGroup[] {
  const habitMap = new Map(habits.map((h) => [h.id, h]));
  const todayIso = isoDate(today);

  // Bucket completions by their display date (occurrence_date for scheduled,
  // local date of completed_at for flex).
  const completionsByDate = new Map<string, CompletionWithHabit[]>();
  for (const c of completions) {
    const date = c.occurrence_date ?? isoDate(new Date(c.completed_at));
    appendTo(completionsByDate, date, c);
  }

  // Bucket overrides by their occurrence_date.
  const overridesByDate = new Map<string, HabitOverride[]>();
  for (const o of overrides) {
    appendTo(overridesByDate, o.occurrence_date, o);
  }

  const groups: DayGroup[] = [];
  for (const dayIso of daysInRange) {
    const dayCompletions = completionsByDate.get(dayIso) ?? [];
    const dayOverrides = overridesByDate.get(dayIso) ?? [];
    const isPast = dayIso < todayIso;

    const rows: AgendaRow[] = [];
    const handledCompletionIds = new Set<string>();
    const handledOverrideIds = new Set<string>();

    if (!isPast) {
      // Today or future: expand scheduled habits and overlay completions/skips.
      const dayStart = parseIsoToLocalMidnight(dayIso);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      for (const habit of habits) {
        if (habit.kind !== 'scheduled') continue;
        const occurrences = expandHabit(habit, dayStart, dayEnd);
        for (const occTime of occurrences) {
          const matchedCompletions = dayCompletions.filter(
            (c) => c.habit_id === habit.id && c.occurrence_date === dayIso,
          );
          const matchedSkip = dayOverrides.find(
            (o) => o.habit_id === habit.id && o.kind === 'skip',
          );
          const editOverride = dayOverrides.find(
            (o) =>
              o.habit_id === habit.id &&
              (o.kind === 'edit' || o.kind === 'reschedule'),
          );

          if (matchedCompletions.length > 0) {
            for (const c of matchedCompletions) {
              if (handledCompletionIds.has(c.id)) continue;
              const patch: OccurrencePatch = editOverride?.patch ?? {};
              rows.push({
                kind: 'completion',
                id: c.id,
                habit: {
                  id: c.habits.id,
                  title: patch.title ?? c.habits.title,
                  icon: patch.icon ?? c.habits.icon,
                  color: patch.color ?? c.habits.color,
                },
                time: new Date(c.completed_at),
                isFlex: c.habits.kind === 'flex',
              });
              handledCompletionIds.add(c.id);
            }
          } else if (matchedSkip) {
            if (!handledOverrideIds.has(matchedSkip.id)) {
              rows.push({
                kind: 'skip',
                habitId: habit.id,
                habit: agendaHabitFor(habit),
                time: occTime,
              });
              handledOverrideIds.add(matchedSkip.id);
            }
          } else {
            const patch: OccurrencePatch = editOverride?.patch ?? {};
            rows.push({
              kind: 'scheduled',
              habitId: habit.id,
              habit: {
                id: habit.id,
                title: patch.title ?? habit.title,
                icon: patch.icon ?? habit.icon,
                color: patch.color ?? habit.color,
              },
              time: patch.time ? applyTimePatch(occTime, patch.time) : occTime,
            });
          }
        }
      }
    }

    // Any completions on this day not yet rendered: flex completions, or
    // completions whose scheduled occurrence didn't match expansion (e.g.,
    // habit was deleted or its RRULE changed). Still part of what happened.
    for (const c of dayCompletions) {
      if (handledCompletionIds.has(c.id)) continue;
      const editOverride = dayOverrides.find(
        (o) =>
          o.habit_id === c.habit_id &&
          (o.kind === 'edit' || o.kind === 'reschedule'),
      );
      const patch: OccurrencePatch = editOverride?.patch ?? {};
      rows.push({
        kind: 'completion',
        id: c.id,
        habit: {
          id: c.habits.id,
          title: patch.title ?? c.habits.title,
          icon: patch.icon ?? c.habits.icon,
          color: patch.color ?? c.habits.color,
        },
        time: new Date(c.completed_at),
        isFlex: c.habits.kind === 'flex',
      });
      handledCompletionIds.add(c.id);
    }

    // Any skip overrides on this day not yet rendered.
    for (const o of dayOverrides) {
      if (o.kind !== 'skip') continue;
      if (handledOverrideIds.has(o.id)) continue;
      const h = habitMap.get(o.habit_id);
      if (!h) continue;
      rows.push({
        kind: 'skip',
        habitId: h.id,
        habit: agendaHabitFor(h),
        time: skipRowTime(h, dayIso),
      });
      handledOverrideIds.add(o.id);
    }

    // Sort chronologically; rows without a time sink to the end.
    rows.sort((a, b) => {
      const ta = a.time?.getTime() ?? Number.POSITIVE_INFINITY;
      const tb = b.time?.getTime() ?? Number.POSITIVE_INFINITY;
      return ta - tb;
    });

    groups.push({ date: dayIso, rows });
  }

  return groups;
}

function agendaHabitFor(h: Habit): AgendaHabit {
  return { id: h.id, title: h.title, icon: h.icon, color: h.color };
}

function appendTo<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const bucket = map.get(key);
  if (bucket) bucket.push(value);
  else map.set(key, [value]);
}

function parseIsoToLocalMidnight(iso: string): Date {
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function skipRowTime(habit: Habit, occurrenceDate: string): Date | null {
  if (!habit.dtstart) return null;
  const [y, m, d] = occurrenceDate.split('-').map((n) => parseInt(n, 10));
  const dt = new Date(habit.dtstart);
  return new Date(y, m - 1, d, dt.getHours(), dt.getMinutes(), 0, 0);
}

function applyTimePatch(occ: Date, hhmm: string): Date {
  const [hh, mm] = hhmm.split(':').map((n) => parseInt(n, 10));
  const out = new Date(occ);
  out.setHours(hh, mm, 0, 0);
  return out;
}

// ─── Query ────────────────────────────────────────────────────────────────

// Fetch one month of completions + overrides for the current user.
// RLS scopes both queries to the user's own data.
export async function fetchMonth(
  userId: string,
  year: number,
  month: number,
): Promise<{
  completions: CompletionWithHabit[];
  overrides: HabitOverride[];
}> {
  const firstIso = isoDate(new Date(year, month - 1, 1));
  const firstNextIso = isoDate(new Date(year, month, 1));

  const { data: completions, error: cErr } = await supabase
    .from('habit_completions')
    .select('*, habits!inner(id, title, icon, color, kind)')
    .eq('owner_id', userId)
    .or(
      `and(occurrence_date.gte.${firstIso},occurrence_date.lt.${firstNextIso}),and(occurrence_date.is.null,completed_at.gte.${firstIso},completed_at.lt.${firstNextIso})`,
    );
  if (cErr) throw cErr;

  const { data: overrides, error: oErr } = await supabase
    .from('habit_overrides')
    .select('*')
    .gte('occurrence_date', firstIso)
    .lt('occurrence_date', firstNextIso);
  if (oErr) throw oErr;

  return {
    completions: (completions ?? []) as CompletionWithHabit[],
    overrides: (overrides ?? []) as HabitOverride[],
  };
}
