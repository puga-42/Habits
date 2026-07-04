import * as Crypto from 'expo-crypto';

import { supabase } from './supabase';
import type { Habit } from './habits';
import { isoDate, markFlexCompleted, markScheduledCompleted, weekStart } from './habits';
import { flexPeriodStartFor } from './history';

export type TimeEntry = {
  id: string;
  habit_id: string;
  owner_id: string;
  occurrence_date: string | null;
  period_start: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  created_at: string;
};

// ─── Pure helpers ─────────────────────────────────────────────────────────────

export function sumDurationSeconds(entries: TimeEntry[], now?: Date): number {
  let total = 0;
  for (const e of entries) {
    if (e.duration_seconds != null) {
      total += e.duration_seconds;
    } else if (e.ended_at == null && now) {
      const started = new Date(e.started_at).getTime();
      total += Math.max(0, Math.floor((now.getTime() - started) / 1000));
    }
  }
  return total;
}

export function progressFraction(entries: TimeEntry[], targetSeconds: number, now?: Date): number {
  return Math.min(1, sumDurationSeconds(entries, now) / targetSeconds);
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function fetchTimeEntries(
  habitId: string,
  occurrenceDate: string | null,
  periodStart: string | null,
): Promise<TimeEntry[]> {
  let query = supabase
    .from('time_entries')
    .select('*')
    .eq('habit_id', habitId);

  if (occurrenceDate) {
    query = query.eq('occurrence_date', occurrenceDate);
  } else if (periodStart) {
    query = query.eq('period_start', periodStart);
  }

  const { data, error } = await query.order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as TimeEntry[];
}

// Total logged seconds per time-habit for a given day, in ONE query instead of
// one per habit. Scheduled habits bucket by occurrence_date == dateIso; flex
// habits by their period start. Returns a map keyed by habit id (habits with no
// entries map to 0).
export async function sumTimeBasesForHabits(
  habits: Habit[],
  dateIso: string,
): Promise<Map<string, number>> {
  const bases = new Map<string, number>();
  if (habits.length === 0) return bases;

  const params = new Map(
    habits.map((h) => [h.id, dateParamsForHabitOn(h, dateIso)] as const),
  );
  const periodStarts = [
    ...new Set(
      [...params.values()]
        .map((p) => p.periodStart)
        .filter((p): p is string => p != null),
    ),
  ];

  const filters = [`occurrence_date.eq.${dateIso}`];
  if (periodStarts.length > 0) {
    filters.push(`period_start.in.(${periodStarts.join(',')})`);
  }

  const { data, error } = await supabase
    .from('time_entries')
    .select('*')
    .in(
      'habit_id',
      habits.map((h) => h.id),
    )
    .or(filters.join(','));
  if (error) throw error;
  const rows = (data ?? []) as TimeEntry[];

  for (const h of habits) {
    const { occurrenceDate, periodStart } = params.get(h.id)!;
    const matching = rows.filter(
      (r) =>
        r.habit_id === h.id &&
        (occurrenceDate != null
          ? r.occurrence_date === occurrenceDate
          : r.period_start === periodStart),
    );
    bases.set(h.id, sumDurationSeconds(matching));
  }
  return bases;
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function startTimeEntry(
  habitId: string,
  ownerId: string,
  occurrenceDate: string | null,
  periodStart: string | null,
): Promise<{ id: string; startedAt: string }> {
  const id = Crypto.randomUUID();
  const startedAt = new Date().toISOString();
  const { error } = await supabase.from('time_entries').insert({
    id,
    habit_id: habitId,
    owner_id: ownerId,
    occurrence_date: occurrenceDate,
    period_start: periodStart,
    started_at: startedAt,
  });
  if (error) throw error;
  return { id, startedAt };
}

export async function stopTimeEntry(entryId: string, startedAt: string): Promise<number> {
  const now = new Date();
  const started = new Date(startedAt).getTime();
  const duration = Math.max(0, Math.floor((now.getTime() - started) / 1000));

  const { error } = await supabase
    .from('time_entries')
    .update({ ended_at: now.toISOString(), duration_seconds: duration })
    .eq('id', entryId);
  if (error) throw error;
  return duration;
}

export async function deleteTimeEntries(
  habitId: string,
  occurrenceDate: string | null,
  periodStart: string | null,
): Promise<void> {
  let query = supabase
    .from('time_entries')
    .delete()
    .eq('habit_id', habitId);

  if (occurrenceDate) {
    query = query.eq('occurrence_date', occurrenceDate);
  } else if (periodStart) {
    query = query.eq('period_start', periodStart);
  }

  const { error } = await query;
  if (error) throw error;
}

// ─── Auto-complete ────────────────────────────────────────────────────────────

export function dateParamsForHabit(habit: Habit): {
  occurrenceDate: string | null;
  periodStart: string | null;
} {
  return dateParamsForHabitOn(habit, isoDate(new Date()));
}

export function dateParamsForHabitOn(
  habit: Habit,
  dateIso: string,
): { occurrenceDate: string | null; periodStart: string | null } {
  if (habit.kind === 'scheduled') {
    return { occurrenceDate: dateIso, periodStart: null };
  }
  return {
    occurrenceDate: null,
    periodStart: flexPeriodStartFor(dateIso, habit.target_period ?? 'week'),
  };
}

// Whether a completion already exists for a habit's occurrence (scheduled) or
// period (flex). Used to keep auto-complete idempotent.
async function completionExists(
  habitId: string,
  key: { occurrenceDate: string } | { periodStart: string },
): Promise<boolean> {
  let query = supabase
    .from('habit_completions')
    .select('id')
    .eq('habit_id', habitId);
  query =
    'occurrenceDate' in key
      ? query.eq('occurrence_date', key.occurrenceDate)
      : query.eq('period_start', key.periodStart);
  const { data, error } = await query.limit(1).maybeSingle();
  if (error) throw error;
  return data != null;
}

export async function checkAndAutoComplete(
  habitId: string,
  ownerId: string,
  habit: Habit,
  occurrenceDate: string | null,
  periodStart: string | null,
): Promise<boolean> {
  if (habit.unit !== 'time' || !habit.target_seconds) return false;

  const entries = await fetchTimeEntries(habitId, occurrenceDate, periodStart);
  const total = sumDurationSeconds(entries);

  if (total < habit.target_seconds) return false;

  // Auto-complete fires on every timer stop once the target is met. Only create
  // a completion if one doesn't already exist for this occurrence/period —
  // otherwise a second session (or a flex habit, which has no DB uniqueness)
  // would pile up duplicate completions.
  if (habit.kind === 'scheduled' && occurrenceDate) {
    if (await completionExists(habitId, { occurrenceDate })) return false;
    await markScheduledCompleted(habitId, ownerId, occurrenceDate);
  } else if (habit.kind === 'flex' && periodStart) {
    if (await completionExists(habitId, { periodStart })) return false;
    await markFlexCompleted(habitId, ownerId, periodStart);
  }
  return true;
}
