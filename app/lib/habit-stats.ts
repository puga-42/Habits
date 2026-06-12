// Habit stats — lineage-wide completion count + the streak inputs, fetched for
// the habit overview. Mirrors the stat columns `fetch_feed_page` returns so the
// streak shown on the overview always matches the one on the feed (same inputs,
// same lib/streak.ts computeStreak). Pure helpers are TDD'd; see
// __tests__/habit-stats.test.ts.

import { computeStreak } from "./streak";
import { supabase } from "./supabase";
import type { Habit } from "./habits";

// All-time, lineage-scoped. completion_history / skip_history are the most
// recent ~100 dates (YYYY-MM-DD), newest first — same cap and shape as the feed.
export type HabitStats = {
  completion_count: number;
  completion_history: string[];
  skip_history: string[];
};

// Fetch a lineage's stats, RLS/visibility enforced server-side. Returns null
// when the viewer may not see the habit (or the RPC isn't deployed yet), so the
// caller can simply hide the badges rather than error.
export async function fetchHabitStats(
  targetId: string,
  viewerId: string,
  lineageId: string,
): Promise<HabitStats | null> {
  const { data, error } = await supabase.rpc("fetch_habit_stats", {
    p_target_id: targetId,
    p_viewer_id: viewerId,
    p_lineage_id: lineageId,
  });
  if (error) throw error;
  const rows = (data ?? []) as Array<{
    completion_count: number | null;
    completion_history: string[] | null;
    skip_history: string[] | null;
  }>;
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    completion_count: row.completion_count ?? 0,
    completion_history: row.completion_history ?? [],
    skip_history: row.skip_history ?? [],
  };
}

// Current streak for a habit given its lineage stats. Reuses the shared,
// cadence-aware computeStreak so the overview and feed never disagree.
export function habitStreak(
  habit: Habit,
  stats: HabitStats,
  now: Date,
): number {
  return computeStreak(
    {
      kind: habit.kind,
      rrule: habit.rrule,
      dtstart: habit.dtstart,
      until: habit.until,
      target_count: habit.target_count,
      target_period: habit.target_period,
      completion_dates: stats.completion_history,
      skip_dates: stats.skip_history,
    },
    now,
  );
}
