-- Multi-identity memberships: a habit may belong to SEVERAL identities at
-- once (product change 2026-07-09; "identity" is the user-facing word for a
-- group — see CONTEXT.md). The one-active-group invariant is retired:
--
--   habit_group_members_one_active   unique (lineage_id) where open
--
-- is replaced by uniqueness per (lineage, group), so a habit still can't hold
-- two open memberships in the SAME identity, but may hold one per identity.
-- The client no longer ends other identities' memberships on add
-- (lib/group-mutations.addHabitToGroup). Additive/index-only — no data change,
-- and existing single-membership rows already satisfy the new index.

drop index if exists public.habit_group_members_one_active;

create unique index habit_group_members_one_active_per_group
  on public.habit_group_members (lineage_id, group_id)
  where effective_until is null;
