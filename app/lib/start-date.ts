// Start-date move guard. Moving a scheduled habit's Starts date FORWARD past
// existing completions would orphan them (their occurrences no longer exist),
// so the edit screen blocks it and tells the user. Moving the start further
// into the past is always allowed — completions can only exist on or after the
// original start, so a backward move can never strand one.
//
// Row-scoped on purpose: after a "this and future" fork, completions on older
// lineage rows are governed by those rows' own dtstart/until and are untouched
// by editing this row's start.

import { isoDate, type Habit } from './habits';
import { supabase } from './supabase';

// Pure core (TDD'd, no mocks). Returns the earliest completion occurrence_date
// strictly before the new start when the start moved forward; null when the
// move is allowed. Dates compare as YYYY-MM-DD strings.
export function blockingCompletionDate(
  originalDtstartIso: string | null,
  newStartIso: string,
  completionDates: (string | null)[],
): string | null {
  if (!originalDtstartIso) return null;
  const originalIso = isoDate(new Date(originalDtstartIso));
  if (newStartIso <= originalIso) return null; // unchanged or moved backward

  let earliest: string | null = null;
  for (const d of completionDates) {
    if (!d || d >= newStartIso) continue;
    if (earliest === null || d < earliest) earliest = d;
  }
  return earliest;
}

// Fetch the edited row's completion dates and run the pure check. Returns the
// earliest blocking date, or null when the save may proceed.
export async function checkStartDateMove(
  habit: Habit,
  newStart: Date,
): Promise<string | null> {
  if (habit.kind !== 'scheduled' || !habit.dtstart) return null;
  const newStartIso = isoDate(newStart);
  const originalIso = isoDate(new Date(habit.dtstart));
  if (newStartIso <= originalIso) return null; // skip the query entirely

  const { data, error } = await supabase
    .from('habit_completions')
    .select('occurrence_date')
    .eq('habit_id', habit.id);
  if (error) throw error;

  const dates = (data ?? []).map(
    (r: { occurrence_date: string | null }) => r.occurrence_date,
  );
  return blockingCompletionDate(habit.dtstart, newStartIso, dates);
}
