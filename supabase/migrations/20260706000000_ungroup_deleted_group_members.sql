-- Repair: deleting a group is a SOFT delete (deleted_at), so the
-- `on delete cascade` on habit_group_members never fired and open memberships
-- kept pointing at deleted groups. The day view buckets habits by membership
-- and only renders fetched (non-deleted) groups, so those habits silently
-- vanished from the list even though their rows were never touched.
--
-- The client now ends open memberships when a group is deleted
-- (lib/group-mutations.ts deleteGroup) and renders unknown-group memberships
-- as ungrouped (lib/day-items.ts). This migration repairs rows already
-- orphaned by past deletions. Additive/data-only — no schema change.

-- Open memberships that never covered a day before the group was deleted:
-- closing them would violate the effective_until >= effective_from check
-- constraint, so remove the rows outright.
delete from public.habit_group_members m
using public.habit_groups g
where g.id = m.group_id
  and g.deleted_at is not null
  and m.effective_until is null
  and m.effective_from >= (g.deleted_at at time zone 'utc')::date;

-- Older open memberships: close the window the day before the group was
-- deleted, keeping past completions attributed to the (deleted) group.
update public.habit_group_members m
set effective_until = (g.deleted_at at time zone 'utc')::date - 1
from public.habit_groups g
where g.id = m.group_id
  and g.deleted_at is not null
  and m.effective_until is null;
