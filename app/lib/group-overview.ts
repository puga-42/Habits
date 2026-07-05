// Group overview — read surface for a single group: identity, description,
// metrics, member habits, and a mosaic of recent member-completion photos.
// Mirrors the habit overview (lib/use-habit-overview.ts). Pure helpers are
// TDD'd in __tests__/group-overview.test.ts (no mocks); the queries are thin
// wrappers RLS scopes to the owner.

import { signedUrlsForPaths } from './feed';
import { groupContainsOn, type GroupMembership, type HabitGroup } from './groups';
import type { Habit } from './habits';
import { supabase } from './supabase';

// ─── Pure helpers (TDD core) ───────────────────────────────────────────────

// The distinct lineage_ids that are active members of `groupId` on `onIso` —
// i.e. a membership window of this group covers that day. Deduped: a lineage
// with several covering windows counts once.
export function activeMemberLineages(
  memberships: GroupMembership[],
  groupId: string,
  onIso: string,
): string[] {
  const seen = new Set<string>();
  for (const m of memberships) {
    if (m.group_id !== groupId) continue;
    if (!groupContainsOn(m, onIso)) continue;
    seen.add(m.lineage_id);
  }
  return [...seen];
}

// Window-scoped completion count: the number of member completion-days that
// fall *within* a member's membership window. NO LONGER drives the overview
// header — product decision (2026-07-05): groups are wrappers around habits,
// so the overview sums the current members' all-time counts instead (see
// use-group-overview.ts / group-streak.ts). Kept for window-scoped needs.
//
// NOTE: `daysByLineage` comes from the lineage completion history (capped at the
// most recent ~100 days, like the streak inputs), so for a very active group
// this is a recent-window count, not strictly all-time. Documented, not hidden.
export function countCompletionsInWindows(
  memberships: GroupMembership[],
  groupId: string,
  daysByLineage: Map<string, Set<string>>,
): number {
  let total = 0;
  for (const m of memberships) {
    if (m.group_id !== groupId) continue;
    const days = daysByLineage.get(m.lineage_id);
    if (!days) continue;
    for (const day of days) {
      if (groupContainsOn(m, day)) total++;
    }
  }
  return total;
}

// Resolve each lineage to a single representative habit row for display. A
// "this and future" edit forks a lineage into several rows (see CONTEXT.md);
// the latest-starting one carries the current title/color/icon. Falls back to
// created_at when dtstart is null (flex habits have no dtstart).
export function currentHabitByLineage(habits: Habit[]): Map<string, Habit> {
  const out = new Map<string, Habit>();
  for (const habit of habits) {
    const existing = out.get(habit.lineage_id);
    if (!existing || startKey(habit) > startKey(existing)) {
      out.set(habit.lineage_id, habit);
    }
  }
  return out;
}

function startKey(habit: Habit): string {
  return habit.dtstart ?? habit.created_at;
}

// ─── Queries ───────────────────────────────────────────────────────────────

// HabitGroup plus the description column this feature adds. Kept local (rather
// than widening the base HabitGroup type) so nothing else has to change until a
// description writer ships; `description` is optional/absent pre-migration.
export type GroupWithDescription = HabitGroup & { description: string | null };

// One group row by id. RLS restricts this to the owner. `select('*')` keeps the
// page working before the description migration is pushed (the column is simply
// absent and `description` reads as undefined → rendered empty).
export async function fetchGroup(id: string): Promise<GroupWithDescription | null> {
  const { data, error } = await supabase
    .from('habit_groups')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { description: null, ...(data as HabitGroup) } as GroupWithDescription;
}

export type MemberPhoto = { path: string; completedAt: string };

// Recent photo attachments across the given member habit rows, newest first.
// Returns storage paths (caller signs them via signedUrlsForPaths). RLS scopes
// completions + attachments to the owner. Videos are excluded — the mosaic is
// thumbnails only.
export async function fetchGroupMemberPhotos(
  habitIds: string[],
  limit = 12,
): Promise<MemberPhoto[]> {
  if (habitIds.length === 0) return [];

  const { data: comps, error: cErr } = await supabase
    .from('habit_completions')
    .select('id, completed_at')
    .in('habit_id', habitIds)
    .order('completed_at', { ascending: false })
    .limit(60);
  if (cErr) throw cErr;

  const rows = (comps ?? []) as { id: string; completed_at: string }[];
  if (rows.length === 0) return [];
  const completedAtById = new Map(rows.map((r) => [r.id, r.completed_at]));

  const { data: atts, error: aErr } = await supabase
    .from('completion_attachments')
    .select('completion_id, storage_path, kind, sort_order')
    .in('completion_id', [...completedAtById.keys()])
    .eq('kind', 'photo')
    .order('sort_order', { ascending: true });
  if (aErr) throw aErr;

  const photos = ((atts ?? []) as {
    completion_id: string;
    storage_path: string;
  }[]).map((a) => ({
    path: a.storage_path,
    completedAt: completedAtById.get(a.completion_id) ?? '',
  }));

  // Newest first by the parent completion, then cap.
  photos.sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  return photos.slice(0, limit);
}

// Sign a list of member-photo paths for display. Thin pass-through to the shared
// feed signer so the mosaic and the feed share one signed-URL path/TTL.
export async function signMemberPhotos(
  photos: MemberPhoto[],
): Promise<Map<string, string>> {
  return signedUrlsForPaths(photos.map((p) => p.path));
}
