// Groups — identity-based bundles of habits (Atomic Habits "identity").
// A group names who the user wants to become; its member habits render together
// in a collapsible card on the day-view and the group carries its own streak.
//
// Membership is TIME-SCOPED, keyed by lineage_id (the user-facing "habit", not a
// single row — mirrors streak segments / stats). A membership row has a window
// [effective_from, effective_until]; group metrics count a completion iff the
// completing habit's window covers that completion's date. This is what lets a
// habit be "removed going forward" while the group keeps its past completions.
//
// Pure window helpers are TDD'd; see __tests__/groups.test.ts. No mocks.
// Mutations live in group-mutations.ts to keep this file's read/pure surface lean.

import { supabase } from './supabase';

// ─── Types ───────────────────────────────────────────────────────────────────

export type HabitGroup = {
  id: string;
  owner_id: string;
  name: string;
  color: string | null;
  icon: string | null;
  sort_index: number;
  collapsed: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type GroupMembership = {
  id: string;
  group_id: string;
  lineage_id: string;
  owner_id: string;
  effective_from: string; // YYYY-MM-DD, inclusive
  effective_until: string | null; // YYYY-MM-DD inclusive; null = still a member
  created_at: string;
};

// ─── Pure helpers (TDD core) ───────────────────────────────────────────────

// Does a membership's window cover a given local day? Both bounds inclusive;
// a null effective_until is open-ended (covers all later days, incl. the future).
// ISO YYYY-MM-DD compares lexicographically, so plain string comparison is safe.
export function groupContainsOn(m: GroupMembership, dateIso: string): boolean {
  if (dateIso < m.effective_from) return false;
  if (m.effective_until !== null && dateIso > m.effective_until) return false;
  return true;
}

// EVERY identity a lineage belongs to on a given day (multi-identity: a habit
// may serve several identities at once). Deduped, in membership order.
export function activeGroupIdsFor(
  memberships: GroupMembership[],
  lineageId: string,
  onIso: string,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of memberships) {
    if (m.lineage_id !== lineageId) continue;
    if (!groupContainsOn(m, onIso)) continue;
    if (seen.has(m.group_id)) continue;
    seen.add(m.group_id);
    out.push(m.group_id);
  }
  return out;
}

// ONE group for a lineage on a given day, or null — the habit form's
// single-select picker seed. Prefers the still-open membership; among
// only-closed windows, the latest-starting one.
export function activeGroupIdFor(
  memberships: GroupMembership[],
  lineageId: string,
  onIso: string,
): string | null {
  const covering = memberships.filter(
    (m) => m.lineage_id === lineageId && groupContainsOn(m, onIso),
  );
  if (covering.length === 0) return null;
  const open = covering.find((m) => m.effective_until === null);
  if (open) return open.group_id;
  return [...covering].sort((a, b) =>
    b.effective_from.localeCompare(a.effective_from),
  )[0].group_id;
}

// Next sort_index for a new group. Mirrors habits.ts nextSortIndexFromList.
export function nextGroupSortIndexFromList(indexes: number[]): number {
  if (indexes.length === 0) return 1;
  return Math.max(...indexes) + 1;
}

// What the habit form must do to reconcile after the user changes its
// single-select Identity picker. Multi-identity: an 'add' just joins the
// picked identity (other memberships are untouched); clearing ('remove') uses
// the "going forward" semantics so the identity keeps the habit's past
// completions (see group-mutations.removeHabitFromGroupFuture).
export type GroupChange =
  | { kind: 'none' }
  | { kind: 'add'; groupId: string }
  | { kind: 'remove'; groupId: string };

export function planGroupChange(
  prev: string | null,
  next: string | null,
): GroupChange {
  if (prev === next) return { kind: 'none' };
  if (next) return { kind: 'add', groupId: next };
  return { kind: 'remove', groupId: prev as string };
}

// How to end open memberships when a lineage leaves a group as of `fromIso`
// (switching groups, or the group being deleted). Windows that began before
// `fromIso` close at the day before, keeping past completions attributed. A
// window that only began ON or after `fromIso` never covered an earlier day —
// closing it would violate the effective_until >= effective_from check
// constraint (the same-day group-switch save error) — so its row is deleted.
export type MembershipEndPlan = { closeIds: string[]; deleteIds: string[] };

export function planMembershipEnd(
  open: Pick<GroupMembership, 'id' | 'effective_from'>[],
  fromIso: string,
): MembershipEndPlan {
  const closeIds: string[] = [];
  const deleteIds: string[] = [];
  for (const m of open) {
    if (m.effective_from >= fromIso) deleteIds.push(m.id);
    else closeIds.push(m.id);
  }
  return { closeIds, deleteIds };
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

// ─── Queries ───────────────────────────────────────────────────────────────

export async function fetchGroups(ownerId: string): Promise<HabitGroup[]> {
  const { data, error } = await supabase
    .from('habit_groups')
    .select('*')
    .eq('owner_id', ownerId)
    .is('deleted_at', null)
    .order('sort_index', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as HabitGroup[];
}

// All memberships for the owner — active AND historical (closed windows). The
// day-view and group metrics both need past windows, so we never filter by
// effective_until here.
export async function fetchMemberships(ownerId: string): Promise<GroupMembership[]> {
  const { data, error } = await supabase
    .from('habit_group_members')
    .select('*')
    .eq('owner_id', ownerId)
    .order('effective_from', { ascending: true });
  if (error) throw error;
  return (data ?? []) as GroupMembership[];
}
