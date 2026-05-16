import * as Crypto from 'expo-crypto';
import { rrulestr } from 'rrule';

import { supabase } from './supabase';

export type HabitKind = 'scheduled' | 'flex';
export type Visibility = 'public' | 'friends' | 'private';
export type FlexPeriod = 'day' | 'week' | 'month';

export type Habit = {
  id: string;
  lineage_id: string;
  owner_id: string;
  kind: HabitKind;
  title: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  visibility: Visibility;
  timezone: string;
  dtstart: string | null;
  rrule: string | null;
  until: string | null;
  target_count: number | null;
  target_period: FlexPeriod | null;
  sort_index: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type Completion = {
  id: string;
  habit_id: string;
  owner_id: string;
  occurrence_date: string | null;
  period_start: string | null;
  completed_at: string;
  note: string | null;
  visibility_override: Visibility | null;
  created_at: string;
  updated_at: string;
};

export type ScheduledOccurrence = {
  habit: Habit;
  occurrenceDate: string; // YYYY-MM-DD
  occurrenceTime: Date;
};

// ─── Queries ───────────────────────────────────────────────────────────────

export async function fetchHabits(ownerId: string): Promise<Habit[]> {
  const { data, error } = await supabase
    .from('habits')
    .select('*')
    .eq('owner_id', ownerId)
    .is('deleted_at', null)
    .order('sort_index', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Habit[];
}

export async function fetchTodayCompletions(ownerId: string): Promise<Completion[]> {
  const today = isoDate(new Date());
  const wk = isoDate(weekStart(new Date()));
  const { data, error } = await supabase
    .from('habit_completions')
    .select('*')
    .eq('owner_id', ownerId)
    .or(`occurrence_date.eq.${today},period_start.eq.${wk}`);
  if (error) throw error;
  return (data ?? []) as Completion[];
}

// ─── RRULE expansion ───────────────────────────────────────────────────────

export function todaysScheduledOccurrences(habits: Habit[]): ScheduledOccurrence[] {
  const dayStart = startOfDay(new Date());
  const dayEnd = endOfDay(new Date());
  const result: ScheduledOccurrence[] = [];

  for (const habit of habits) {
    if (habit.kind !== 'scheduled' || !habit.rrule || !habit.dtstart) continue;
    try {
      const dtstart = new Date(habit.dtstart);
      const rule = rrulestr(habit.rrule, { dtstart });
      const dates = rule.between(dayStart, dayEnd, true);
      for (const d of dates) {
        result.push({ habit, occurrenceDate: isoDate(d), occurrenceTime: d });
      }
    } catch (err) {
      console.warn('RRULE parse failed for habit', habit.id, err);
    }
  }

  return result.sort(
    (a, b) => a.occurrenceTime.getTime() - b.occurrenceTime.getTime(),
  );
}

// ─── Mutations ─────────────────────────────────────────────────────────────

export async function markScheduledCompleted(
  habitId: string,
  ownerId: string,
  occurrenceDate: string,
): Promise<string> {
  const id = Crypto.randomUUID();
  const { error } = await supabase.from('habit_completions').insert({
    id,
    habit_id: habitId,
    owner_id: ownerId,
    occurrence_date: occurrenceDate,
  });
  if (error) throw error;
  return id;
}

export async function markFlexCompleted(
  habitId: string,
  ownerId: string,
): Promise<string> {
  const id = Crypto.randomUUID();
  const { error } = await supabase.from('habit_completions').insert({
    id,
    habit_id: habitId,
    owner_id: ownerId,
    period_start: isoDate(weekStart(new Date())),
  });
  if (error) throw error;
  return id;
}

export async function unmarkCompleted(completionId: string): Promise<void> {
  const { error } = await supabase
    .from('habit_completions')
    .delete()
    .eq('id', completionId);
  if (error) throw error;
}

// What the habit editor passes in. Mirrors the DB shape after the
// scheduled/flex split is decided by the caller.
export type HabitInsert = {
  title: string;
  kind: HabitKind;
  icon: string;
  color: string;
  visibility: Visibility;
  timezone: string;
  // scheduled-only
  dtstart?: string;
  rrule?: string;
  until?: string | null;
  // flex-only
  target_count?: number;
  target_period?: FlexPeriod;
};

export async function createHabit(
  ownerId: string,
  input: HabitInsert,
): Promise<void> {
  const sortIndex = await nextSortIndex(ownerId);
  const { error } = await supabase
    .from('habits')
    .insert({ owner_id: ownerId, sort_index: sortIndex, ...input });
  if (error) throw error;
}

// Pure: next sort_index given the current list of existing indexes.
export function nextSortIndexFromList(indexes: number[]): number {
  if (indexes.length === 0) return 1;
  return Math.max(...indexes) + 1;
}

// Looks up the owner's current max sort_index and returns +1.
export async function nextSortIndex(ownerId: string): Promise<number> {
  const { data, error } = await supabase
    .from('habits')
    .select('sort_index')
    .eq('owner_id', ownerId)
    .is('deleted_at', null);
  if (error) throw error;
  const indexes = (data ?? []).map((r: { sort_index: number }) => r.sort_index);
  return nextSortIndexFromList(indexes);
}

// Pure: apply a section-local reorder to the full habits list, preserving
// the relative position of every habit NOT in the reordered section.
//
// `sectionIds` is the new order of habit IDs in the section the user
// rearranged (e.g. "not-completed on Tuesday"). We find the slots those
// habits occupy in the current sorted list and refill them in the new order;
// habits outside `sectionIds` stay put. This is important for the schedule
// view, where many days are visible at once and the old behavior (yanking
// every visible-on-this-day habit to the front of the global list) caused
// rows on other days to jump around when the user reordered one day's section.
export function applySectionReorder(
  habits: Habit[],
  sectionIds: string[],
): Habit[] {
  const byId = new Map(habits.map((h) => [h.id, h]));
  const sectionSet = new Set(sectionIds.filter((id) => byId.has(id)));
  const filteredSectionIds = sectionIds.filter((id) => sectionSet.has(id));

  const baseline = [...habits].sort(
    (a, b) =>
      a.sort_index - b.sort_index || a.created_at.localeCompare(b.created_at),
  );

  let cursor = 0;
  const result: Habit[] = [];
  for (const current of baseline) {
    if (sectionSet.has(current.id)) {
      const nextId = filteredSectionIds[cursor++];
      const replacement = byId.get(nextId);
      if (replacement) result.push(replacement);
    } else {
      result.push(current);
    }
  }

  return result.map((h, i) => ({ ...h, sort_index: i + 1 }));
}

// Apply a new ordering: each id gets sort_index = position + 1.
// RLS scopes updates to the user's own rows.
export async function reorderHabits(orderedIds: string[]): Promise<void> {
  const updates = orderedIds.map((id, idx) =>
    supabase.from('habits').update({ sort_index: idx + 1 }).eq('id', id),
  );
  const results = await Promise.all(updates);
  for (const r of results) {
    if (r.error) throw r.error;
  }
}

// ─── Edit + override mutations ─────────────────────────────────────────────

export type OccurrencePatch = {
  title?: string;
  icon?: string;
  color?: string;
  time?: string; // HH:MM 24h
};

export type HabitOverride = {
  id: string;
  habit_id: string;
  occurrence_date: string;
  kind: 'skip' | 'reschedule' | 'edit';
  patch: OccurrencePatch | null;
  created_at: string;
};

export async function fetchHabit(id: string): Promise<Habit> {
  const { data, error } = await supabase
    .from('habits')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as Habit;
}

export async function fetchTodayOverrides(): Promise<HabitOverride[]> {
  // RLS limits these to overrides on habits the user owns.
  const today = isoDate(new Date());
  const { data, error } = await supabase
    .from('habit_overrides')
    .select('*')
    .eq('occurrence_date', today);
  if (error) throw error;
  return (data ?? []) as HabitOverride[];
}

// "All occurrences" — update the master row.
export async function applyEditAll(
  habitId: string,
  update: Partial<HabitInsert>,
): Promise<void> {
  const { error } = await supabase
    .from('habits')
    .update(update)
    .eq('id', habitId);
  if (error) throw error;
}

// "This and future" — cap the old habit's recurrence and start a new habit
// row that shares the same lineage_id. TODO: wrap in an RPC for atomicity.
export async function applyEditFuture(
  ownerId: string,
  original: Habit,
  splitTime: Date,
  newInsert: HabitInsert,
): Promise<void> {
  const oldUntil = new Date(splitTime.getTime() - 1000).toISOString();

  const upd = await supabase
    .from('habits')
    .update({ until: oldUntil })
    .eq('id', original.id);
  if (upd.error) throw upd.error;

  const ins = await supabase
    .from('habits')
    .insert({
      owner_id: ownerId,
      lineage_id: original.lineage_id,
      ...newInsert,
    });
  if (ins.error) throw ins.error;
}

// "This occurrence only" — upsert an `edit` override keyed by occurrence_date.
export async function applyEditThis(
  habitId: string,
  occurrenceDate: string,
  patch: OccurrencePatch,
): Promise<void> {
  const { error } = await supabase
    .from('habit_overrides')
    .upsert(
      {
        habit_id: habitId,
        occurrence_date: occurrenceDate,
        kind: 'edit',
        patch,
      },
      { onConflict: 'habit_id,occurrence_date' },
    );
  if (error) throw error;
}

// ─── Time helpers for overrides ────────────────────────────────────────────

export function formatTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function applyTimeToDate(d: Date, hhmm: string): Date {
  const [hh, mm] = hhmm.split(':').map((n) => parseInt(n, 10));
  const out = new Date(d);
  out.setHours(hh, mm, 0, 0);
  return out;
}

// ─── Date helpers ──────────────────────────────────────────────────────────

// A habit can only be completed on today or a past date. Future dates are
// rejected: you can't have done something that hasn't happened yet.
export function canCompleteOn(dateIso: string, today: Date): boolean {
  return dateIso <= isoDate(today);
}

export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function weekStart(d: Date): Date {
  // Monday-first week.
  const x = startOfDay(d);
  const day = x.getDay(); // 0 (Sun) — 6 (Sat)
  const shift = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + shift);
  return x;
}

// ─── Swipe-action mutations ───────────────────────────────────────────────

export async function skipOccurrence(
  habitId: string,
  occurrenceDate: string,
): Promise<void> {
  const { error } = await supabase
    .from('habit_overrides')
    .upsert(
      { habit_id: habitId, occurrence_date: occurrenceDate, kind: 'skip', patch: null },
      { onConflict: 'habit_id,occurrence_date' },
    );
  if (error) throw error;
}

export async function unskipOccurrence(
  habitId: string,
  occurrenceDate: string,
): Promise<void> {
  const { error } = await supabase
    .from('habit_overrides')
    .delete()
    .eq('habit_id', habitId)
    .eq('occurrence_date', occurrenceDate)
    .eq('kind', 'skip');
  if (error) throw error;
}

export async function unmarkLastFlexInPeriod(
  habitId: string,
  periodStart: string,
): Promise<void> {
  const { data, error: fetchErr } = await supabase
    .from('habit_completions')
    .select('id')
    .eq('habit_id', habitId)
    .eq('period_start', periodStart)
    .order('created_at', { ascending: false })
    .limit(1);
  if (fetchErr) throw fetchErr;
  if (!data || data.length === 0) return;
  const { error } = await supabase
    .from('habit_completions')
    .delete()
    .eq('id', data[0].id);
  if (error) throw error;
}
