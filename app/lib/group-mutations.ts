// Group mutations — CRUD on habit_groups and time-scoped membership writes.
// Split from groups.ts (which holds types, pure window helpers, and reads) to
// keep each file under the 200-line cap. Pure helpers it relies on are in
// groups.ts and tested in __tests__/groups.test.ts.

import * as Crypto from 'expo-crypto';

import { nextGroupSortIndexFromList } from './groups';
import { supabase } from './supabase';

// ─── Group CRUD ──────────────────────────────────────────────────────────────

export type GroupInsert = {
  name: string;
  color?: string | null;
  icon?: string | null;
};

export async function createGroup(
  ownerId: string,
  input: GroupInsert,
): Promise<string> {
  const sortIndex = await nextGroupSortIndex(ownerId);
  const id = Crypto.randomUUID();
  const { error } = await supabase.from('habit_groups').insert({
    id,
    owner_id: ownerId,
    sort_index: sortIndex,
    ...input,
  });
  if (error) throw error;
  return id;
}

export async function renameGroup(groupId: string, name: string): Promise<void> {
  const { error } = await supabase
    .from('habit_groups')
    .update({ name })
    .eq('id', groupId);
  if (error) throw error;
}

export async function setGroupCollapsed(
  groupId: string,
  collapsed: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('habit_groups')
    .update({ collapsed })
    .eq('id', groupId);
  if (error) throw error;
}

export async function reorderGroups(orderedIds: string[]): Promise<void> {
  const updates = orderedIds.map((id, idx) =>
    supabase.from('habit_groups').update({ sort_index: idx + 1 }).eq('id', id),
  );
  const results = await Promise.all(updates);
  for (const r of results) {
    if (r.error) throw r.error;
  }
}

// Soft-delete the group. The FK cascade on habit_group_members drops the
// memberships — a deleted group's habits become ungrouped. Habits themselves
// are untouched (membership is a separate table).
export async function deleteGroup(groupId: string): Promise<void> {
  const { error } = await supabase
    .from('habit_groups')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', groupId);
  if (error) throw error;
}

async function nextGroupSortIndex(ownerId: string): Promise<number> {
  const { data, error } = await supabase
    .from('habit_groups')
    .select('sort_index')
    .eq('owner_id', ownerId)
    .is('deleted_at', null);
  if (error) throw error;
  const indexes = (data ?? []).map((r: { sort_index: number }) => r.sort_index);
  return nextGroupSortIndexFromList(indexes);
}

// ─── Membership mutations ─────────────────────────────────────────────────

// Put a habit (lineage) into a group as of `fromIso`. Enforces one-active-group:
// any currently-open membership for this lineage is first closed the day before
// `fromIso` (its past completions stay with the old group). Then a new open
// membership is inserted. A no-op if the lineage is already actively in `groupId`.
export async function addHabitToGroup(
  ownerId: string,
  lineageId: string,
  groupId: string,
  fromIso: string,
): Promise<void> {
  const { data: open, error: fErr } = await supabase
    .from('habit_group_members')
    .select('id, group_id')
    .eq('lineage_id', lineageId)
    .is('effective_until', null);
  if (fErr) throw fErr;

  const existing = (open ?? []) as { id: string; group_id: string }[];
  if (existing.some((e) => e.group_id === groupId)) return; // already a member

  if (existing.length > 0) {
    const until = dayBefore(fromIso);
    const { error: cErr } = await supabase
      .from('habit_group_members')
      .update({ effective_until: until })
      .in(
        'id',
        existing.map((e) => e.id),
      );
    if (cErr) throw cErr;
  }

  const { error } = await supabase.from('habit_group_members').insert({
    id: Crypto.randomUUID(),
    group_id: groupId,
    lineage_id: lineageId,
    owner_id: ownerId,
    effective_from: fromIso,
  });
  if (error) throw error;
}

// Remove "going forward": the habit stops being a member as of today, but the
// group KEEPS its past completions (window closed at yesterday). Mirrors
// deleteHabitFuture.
export async function removeHabitFromGroupFuture(
  lineageId: string,
  groupId: string,
  todayIso: string,
): Promise<void> {
  const { error } = await supabase
    .from('habit_group_members')
    .update({ effective_until: dayBefore(todayIso) })
    .eq('lineage_id', lineageId)
    .eq('group_id', groupId)
    .is('effective_until', null);
  if (error) throw error;
}

// Remove "all": the group forgets the habit ever belonged — every membership row
// (active and historical) for this lineage/group is deleted, so no past
// completions count toward the group anymore. Mirrors deleteHabitAll.
export async function removeHabitFromGroupAll(
  lineageId: string,
  groupId: string,
): Promise<void> {
  const { error } = await supabase
    .from('habit_group_members')
    .delete()
    .eq('lineage_id', lineageId)
    .eq('group_id', groupId);
  if (error) throw error;
}

// YYYY-MM-DD one day earlier, via UTC-noon to dodge DST edges.
export function dayBefore(iso: string): string {
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() - 1);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}
