// Single-group editor surface — powers app/group/edit.tsx. Pure derivations for
// the member checklist plus the thin detail-update mutation (the first writer
// of habit_groups.description, added in 20260626000000). Membership writes
// reuse group-mutations (addHabitToGroup / removeHabitFromGroupFuture) so the
// time-window semantics stay in one place (multi-identity is allowed).
// Pure helpers are TDD'd in __tests__/group-edit.test.ts (no mocks).

import { currentHabitByLineage } from './group-overview';
import { activeGroupIdsFor, type GroupMembership, type HabitGroup } from './groups';
import type { Habit } from './habits';
import { supabase } from './supabase';

// ─── Pure helpers (TDD core) ───────────────────────────────────────────────

// One checklist row per lineage (the user-facing "habit" — see CONTEXT.md).
export type GroupHabitChoice = {
  lineageId: string;
  title: string;
  icon: string | null;
  color: string | null;
  inGroup: boolean; // active member of the edited identity today
  // First OTHER identity the habit is also in (multi-identity is allowed;
  // shown as an informational "Also in …" hint).
  otherGroupName: string | null;
};

// The checklist for editing `groupId`'s members: every current habit, members
// first then alphabetical. A membership pointing at a group missing from
// `groups` (soft-deleted) counts as ungrouped — a deleted group never claims a
// habit (mirrors day-items.buildDayItems).
export function buildGroupHabitChoices(
  habits: Habit[],
  memberships: GroupMembership[],
  groups: HabitGroup[],
  groupId: string,
  todayIso: string,
): GroupHabitChoice[] {
  const nameById = new Map(groups.map((g) => [g.id, g.name]));
  const choices: GroupHabitChoice[] = [];
  for (const habit of currentHabitByLineage(habits).values()) {
    const gids = activeGroupIdsFor(memberships, habit.lineage_id, todayIso).filter(
      (gid) => nameById.has(gid),
    );
    const firstOther = gids.find((gid) => gid !== groupId);
    choices.push({
      lineageId: habit.lineage_id,
      title: habit.title,
      icon: habit.icon,
      color: habit.color,
      inGroup: gids.includes(groupId),
      otherGroupName: firstOther ? (nameById.get(firstOther) as string) : null,
    });
  }
  return choices.sort(
    (a, b) =>
      Number(b.inGroup) - Number(a.inGroup) || a.title.localeCompare(b.title),
  );
}

// Reconcile the checklist against the members-on-load: which lineages to add
// to the group and which to remove (going forward).
export type MemberEditPlan = {
  addLineageIds: string[];
  removeLineageIds: string[];
};

export function planMemberEdits(
  initial: string[],
  selected: string[],
): MemberEditPlan {
  const before = new Set(initial);
  const after = new Set(selected);
  return {
    addLineageIds: selected.filter((id) => !before.has(id)),
    removeLineageIds: initial.filter((id) => !after.has(id)),
  };
}

// ─── Mutation ───────────────────────────────────────────────────────────────

// Update the identity's fields. Name is required (1–100, DB check);
// description is free-form ≤1000, blank saves as null; color tints the
// day-view card (null = plain surface).
export async function updateGroupDetails(
  groupId: string,
  details: { name: string; description: string | null; color: string | null },
): Promise<void> {
  const { error } = await supabase
    .from('habit_groups')
    .update({
      name: details.name,
      description: details.description,
      color: details.color,
    })
    .eq('id', groupId);
  if (error) throw error;
}
