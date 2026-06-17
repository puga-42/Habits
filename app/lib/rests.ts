import { supabase } from './supabase';
import { type Habit, wakeHabit } from './habits';
import { occurrencesInRange } from './history';

// ─── Rest records ─────────────────────────────────────────────────────────
//
// A "rest" is a per-habit period that makes the habit's due days streak-neutral
// while it carries its own note/media and posts a single feed event. Streak
// neutralization still rides on per-occurrence `habit_overrides` (kind 'skip',
// tagged with `rest_id`) — `habit-stats`/`history` treat those as neutral with
// no change. The `habit_rests` row is the source of truth for the period,
// note/media, and feed post.

export type Rest = {
  id: string;
  habit_id: string;
  owner_id: string;
  start_date: string; // YYYY-MM-DD, inclusive
  end_date: string; // YYYY-MM-DD, inclusive (trimmed on early wake)
  note: string | null;
  visibility_override: Habit['visibility'] | null;
  created_at: string;
  updated_at: string;
};

export type RestPeriod = Pick<Rest, 'start_date' | 'end_date'>;

export type WakeOutcome =
  | { kind: 'cancel' } // the rest never effectively happened — remove it entirely
  | { kind: 'trim'; endDate: string } // keep earlier days neutral; end before `fromIso`
  | { kind: 'noop' }; // the rest already ended — nothing to wake

// The previous calendar day for a YYYY-MM-DD string. UTC math keeps it free of
// timezone drift; the value is a plain date, never a moment in time.
export function dayBeforeIso(iso: string): string {
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

// Decide what waking a rest from `fromIso` forward does. ISO date strings sort
// chronologically, so plain string comparison is safe here.
export function restWakeOutcome(rest: RestPeriod, fromIso: string): WakeOutcome {
  if (fromIso <= rest.start_date) return { kind: 'cancel' };
  if (fromIso > rest.end_date) return { kind: 'noop' };
  return { kind: 'trim', endDate: dayBeforeIso(fromIso) };
}

// ─── Mutations ────────────────────────────────────────────────────────────

// Create a rest for a scheduled habit covering [fromIso, untilIso] inclusive.
// Inserts the rest record, then tags each due day with a neutral override
// pointing back at it. Returns the new rest id.
export async function createRest(
  habit: Habit,
  ownerId: string,
  fromIso: string,
  untilIso: string,
): Promise<string> {
  const { data, error } = await supabase
    .from('habit_rests')
    .insert({
      habit_id: habit.id,
      owner_id: ownerId,
      start_date: fromIso,
      end_date: untilIso,
    })
    .select('id')
    .single();
  if (error) throw error;
  const restId = (data as { id: string }).id;

  const dates = occurrencesInRange(habit, fromIso, untilIso);
  if (dates.length > 0) {
    const rows = dates.map((occurrence_date) => ({
      habit_id: habit.id,
      occurrence_date,
      kind: 'skip' as const,
      patch: null,
      rest_id: restId,
    }));
    const { error: ovErr } = await supabase
      .from('habit_overrides')
      .upsert(rows, { onConflict: 'habit_id,occurrence_date' });
    if (ovErr) throw ovErr;
  }
  return restId;
}

// End a habit's rest from `fromIso` forward. Waking before/at the start cancels
// the rest outright (its overrides cascade away); waking mid-period trims the
// end date and clears only today-and-later neutral days, so past days keep
// bridging the streak. Any untagged legacy neutral days are cleared too.
export async function endRestForHabit(habitId: string, fromIso: string): Promise<void> {
  const { data, error } = await supabase
    .from('habit_rests')
    .select('id, start_date, end_date')
    .eq('habit_id', habitId)
    .gte('end_date', fromIso)
    .order('start_date', { ascending: true })
    .limit(1);
  if (error) throw error;

  const rest = (data ?? [])[0] as
    | { id: string; start_date: string; end_date: string }
    | undefined;

  if (rest) {
    const outcome = restWakeOutcome(rest, fromIso);
    if (outcome.kind === 'cancel') {
      const { error: delErr } = await supabase
        .from('habit_rests')
        .delete()
        .eq('id', rest.id);
      if (delErr) throw delErr;
    } else if (outcome.kind === 'trim') {
      const { error: updErr } = await supabase
        .from('habit_rests')
        .update({ end_date: outcome.endDate })
        .eq('id', rest.id);
      if (updErr) throw updErr;
    }
  }

  // Clear today-and-later neutral days (tagged ones not already removed by a
  // cascade, plus any legacy untagged skips).
  await wakeHabit(habitId, fromIso);
}
