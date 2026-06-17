-- Other-user profile day-view: expose, with the SAME visibility gating used
-- everywhere else, the data a viewer needs to reconstruct another user's day
-- agenda client-side (RRULE expansion is client-only here). Three pieces:
--   1. get_user_visible_habits — extended to also return schedule fields.
--   2. get_user_completions_range — gated completions in a date range.
--   3. get_user_overrides_range — gated skip/edit overrides in a date range.
--
-- Gating (mirrors get_user_feed_page / get_user_activity_heatmap):
--   not is_blocked(viewer, target) AND (
--     viewer = target
--     OR <vis> = 'public'
--     OR (<vis> = 'friends' AND are_friends(viewer, target)))
-- where <vis> is the habit's visibility (or, for a completion,
-- coalesce(completion.visibility_override, habit.visibility)). A private habit
-- therefore never appears to anyone but its owner — schedule, completions, all.

-- ─── 1. Visible habits, now with schedule fields ────────────────────────────

drop function if exists public.get_user_visible_habits(uuid, uuid);

create or replace function public.get_user_visible_habits(
  p_target_id  uuid,
  p_viewer_id  uuid
)
returns table (
  id             uuid,
  lineage_id     uuid,
  title          text,
  description    text,
  icon           text,
  color          text,
  kind           habit_kind,
  visibility     habit_visibility,
  timezone       text,
  dtstart        timestamptz,
  rrule          text,
  until          timestamptz,
  target_count   int,
  target_period  flex_period,
  unit           habit_unit,
  target_seconds int,
  display_unit   time_display_unit
)
language sql stable
security definer
set search_path = public
as $$
  select h.id, h.lineage_id, h.title, h.description, h.icon, h.color, h.kind,
         h.visibility, h.timezone, h.dtstart, h.rrule, h.until,
         h.target_count, h.target_period, h.unit, h.target_seconds, h.display_unit
  from public.habits h
  where h.owner_id = p_target_id
    and h.deleted_at is null
    and not public.is_blocked(p_viewer_id, p_target_id)
    and (
      p_target_id = p_viewer_id
      or h.visibility = 'public'
      or (h.visibility = 'friends'
          and public.are_friends(p_viewer_id, p_target_id))
    )
  order by h.sort_index asc, h.created_at asc;
$$;

grant execute on function public.get_user_visible_habits(uuid, uuid) to authenticated;

-- ─── 2. Completions in a date range ─────────────────────────────────────────

create or replace function public.get_user_completions_range(
  p_target_id  uuid,
  p_viewer_id  uuid,
  p_from       date,
  p_to         date
)
returns table (
  id                  uuid,
  habit_id            uuid,
  owner_id            uuid,
  occurrence_date     date,
  period_start        date,
  completed_at        timestamptz,
  note                text,
  visibility_override habit_visibility,
  created_at          timestamptz,
  updated_at          timestamptz,
  habit_title         text,
  habit_icon          text,
  habit_color         text,
  habit_kind          habit_kind,
  habit_unit          habit_unit
)
language sql stable
security definer
set search_path = public
as $$
  select c.id, c.habit_id, c.owner_id, c.occurrence_date, c.period_start,
         c.completed_at, c.note, c.visibility_override, c.created_at, c.updated_at,
         h.title, h.icon, h.color, h.kind, h.unit
  from public.habit_completions c
  join public.habits h on h.id = c.habit_id
  where c.owner_id = p_target_id
    and not public.is_blocked(p_viewer_id, p_target_id)
    and (
      p_target_id = p_viewer_id
      or coalesce(c.visibility_override, h.visibility) = 'public'
      or (coalesce(c.visibility_override, h.visibility) = 'friends'
          and public.are_friends(p_viewer_id, p_target_id))
    )
    -- Same display-date windowing as the home screen's fetchRange.
    and (
      (c.occurrence_date is not null
         and c.occurrence_date >= p_from and c.occurrence_date < p_to)
      or (c.occurrence_date is null
         and c.completed_at >= p_from and c.completed_at < p_to)
    );
$$;

grant execute on function public.get_user_completions_range(uuid, uuid, date, date) to authenticated;

-- ─── 3. Skip/edit overrides in a date range ─────────────────────────────────

create or replace function public.get_user_overrides_range(
  p_target_id  uuid,
  p_viewer_id  uuid,
  p_from       date,
  p_to         date
)
returns table (
  id              uuid,
  habit_id        uuid,
  occurrence_date date,
  kind            override_kind,
  patch           jsonb,
  created_at      timestamptz
)
language sql stable
security definer
set search_path = public
as $$
  select o.id, o.habit_id, o.occurrence_date, o.kind, o.patch, o.created_at
  from public.habit_overrides o
  join public.habits h on h.id = o.habit_id
  where h.owner_id = p_target_id
    and h.deleted_at is null
    and not public.is_blocked(p_viewer_id, p_target_id)
    and (
      p_target_id = p_viewer_id
      or h.visibility = 'public'
      or (h.visibility = 'friends'
          and public.are_friends(p_viewer_id, p_target_id))
    )
    and o.occurrence_date >= p_from and o.occurrence_date < p_to;
$$;

grant execute on function public.get_user_overrides_range(uuid, uuid, date, date) to authenticated;
