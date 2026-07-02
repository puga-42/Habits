-- Group description: a free-form "who I'm becoming" blurb shown on the group
-- overview page. Additive only — no existing migration is modified, and reads
-- use select('*') so the client works before this is pushed.
--
-- RLS is unchanged: the existing habit_groups_select / habit_groups_modify
-- owner-only policies already cover this column.

alter table public.habit_groups
  add column description text
    check (description is null or char_length(description) <= 1000);
