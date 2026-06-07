import * as Crypto from 'expo-crypto';

import { supabase } from './supabase';
import type { Habit } from './habits';
import { isoDate, markFlexCompleted, markScheduledCompleted, weekStart } from './habits';

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

// ─── Auto-complete ────────────────────────────────────────────────────────────

export function dateParamsForHabit(habit: Habit): {
  occurrenceDate: string | null;
  periodStart: string | null;
} {
  if (habit.kind === 'scheduled') {
    return { occurrenceDate: isoDate(new Date()), periodStart: null };
  }
  return { occurrenceDate: null, periodStart: isoDate(weekStart(new Date())) };
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

  if (habit.kind === 'scheduled' && occurrenceDate) {
    await markScheduledCompleted(habitId, ownerId, occurrenceDate);
  } else if (habit.kind === 'flex') {
    await markFlexCompleted(habitId, ownerId);
  }
  return true;
}
