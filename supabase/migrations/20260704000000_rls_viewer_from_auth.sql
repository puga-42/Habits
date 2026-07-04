-- Security fix (SEC-1): a family of SECURITY DEFINER RPCs took the *viewer*
-- identity as a trusted parameter (p_viewer_id / p_user_a). Because these
-- functions bypass RLS, any authenticated caller could forge that argument
-- (e.g. pass p_viewer_id = p_target_id to trip the "self" branch) and read
-- another user's private habits, completions, notes, and social graph.
--
-- The fix, applied uniformly here: drop the viewer parameter and derive the
-- viewer from auth.uid() inside each function — the same pattern the safe
-- get_user_feed_page already uses. The query logic is otherwise unchanged.
--
-- Old signatures are dropped (their argument lists change), then recreated.

-- ─── 1. fetch_habit_stats — single lineage (overview) ───────────────────────

drop function if exists public.fetch_habit_stats(uuid, uuid, uuid);

create function public.fetch_habit_stats(
  p_target_id  uuid,
  p_lineage_id uuid
)
returns table (
  completion_count   int,
  completion_history jsonb,
  skip_history       jsonb,
  segments           jsonb
)
language sql stable
security definer
set search_path = public
as $$
  with allowed as (
    select 1
    from public.habits h
    where h.lineage_id = p_lineage_id
      and h.owner_id = p_target_id
      and not public.is_blocked(auth.uid(), p_target_id)
      and (
        p_target_id = auth.uid()
        or h.visibility = 'public'
        or (h.visibility = 'friends'
            and public.are_friends(auth.uid(), p_target_id))
      )
    limit 1
  )
  select
    (select count(*)::int
       from public.habit_completions hc
       join public.habits hh on hh.id = hc.habit_id
      where hh.lineage_id = p_lineage_id) as completion_count,
    coalesce((
      select jsonb_agg(t.d order by t.d desc)
      from (
        select coalesce(hc.occurrence_date, hc.period_start) as d
        from public.habit_completions hc
        join public.habits hh on hh.id = hc.habit_id
        where hh.lineage_id = p_lineage_id
          and coalesce(hc.occurrence_date, hc.period_start) is not null
        order by coalesce(hc.occurrence_date, hc.period_start) desc
        limit 100
      ) t
    ), '[]'::jsonb) as completion_history,
    coalesce((
      select jsonb_agg(s.occurrence_date order by s.occurrence_date desc)
      from (
        select ho.occurrence_date
        from public.habit_overrides ho
        join public.habits hh on hh.id = ho.habit_id
        where hh.lineage_id = p_lineage_id and ho.kind = 'skip'
        order by ho.occurrence_date desc
        limit 100
      ) s
    ), '[]'::jsonb) as skip_history,
    public.lineage_segments(p_lineage_id) as segments
  where exists (select 1 from allowed);
$$;

grant execute on function public.fetch_habit_stats(uuid, uuid) to authenticated;

-- ─── 2. fetch_my_habits_stats — every owned lineage (day-view) ──────────────
-- Owner-only by definition; the viewer *is* the owner, so key on auth.uid().

drop function if exists public.fetch_my_habits_stats(uuid);

create function public.fetch_my_habits_stats()
returns table (
  lineage_id         uuid,
  completion_history jsonb,
  skip_history       jsonb,
  segments           jsonb
)
language sql stable
security definer
set search_path = public
as $$
  with my_lineages as (
    select distinct h.lineage_id
    from public.habits h
    where h.owner_id = auth.uid()
  )
  select
    ml.lineage_id,
    coalesce((
      select jsonb_agg(t.d order by t.d desc)
      from (
        select coalesce(hc.occurrence_date, hc.period_start) as d
        from public.habit_completions hc
        join public.habits hh on hh.id = hc.habit_id
        where hh.lineage_id = ml.lineage_id
          and coalesce(hc.occurrence_date, hc.period_start) is not null
        order by coalesce(hc.occurrence_date, hc.period_start) desc
        limit 100
      ) t
    ), '[]'::jsonb) as completion_history,
    coalesce((
      select jsonb_agg(s.occurrence_date order by s.occurrence_date desc)
      from (
        select ho.occurrence_date
        from public.habit_overrides ho
        join public.habits hh on hh.id = ho.habit_id
        where hh.lineage_id = ml.lineage_id and ho.kind = 'skip'
        order by ho.occurrence_date desc
        limit 100
      ) s
    ), '[]'::jsonb) as skip_history,
    public.lineage_segments(ml.lineage_id) as segments
  from my_lineages ml;
$$;

grant execute on function public.fetch_my_habits_stats() to authenticated;

-- ─── 3. get_user_visible_habits ─────────────────────────────────────────────

drop function if exists public.get_user_visible_habits(uuid, uuid);

create function public.get_user_visible_habits(
  p_target_id uuid
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
    and not public.is_blocked(auth.uid(), p_target_id)
    and (
      p_target_id = auth.uid()
      or h.visibility = 'public'
      or (h.visibility = 'friends'
          and public.are_friends(auth.uid(), p_target_id))
    )
  order by h.sort_index asc, h.created_at asc;
$$;

grant execute on function public.get_user_visible_habits(uuid) to authenticated;

-- ─── 4. get_user_completions_range ──────────────────────────────────────────

drop function if exists public.get_user_completions_range(uuid, uuid, date, date);

create function public.get_user_completions_range(
  p_target_id uuid,
  p_from      date,
  p_to        date
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
    and not public.is_blocked(auth.uid(), p_target_id)
    and (
      p_target_id = auth.uid()
      or coalesce(c.visibility_override, h.visibility) = 'public'
      or (coalesce(c.visibility_override, h.visibility) = 'friends'
          and public.are_friends(auth.uid(), p_target_id))
    )
    and (
      (c.occurrence_date is not null
         and c.occurrence_date >= p_from and c.occurrence_date < p_to)
      or (c.occurrence_date is null
         and c.completed_at >= p_from and c.completed_at < p_to)
    );
$$;

grant execute on function public.get_user_completions_range(uuid, date, date) to authenticated;

-- ─── 5. get_user_overrides_range ────────────────────────────────────────────

drop function if exists public.get_user_overrides_range(uuid, uuid, date, date);

create function public.get_user_overrides_range(
  p_target_id uuid,
  p_from      date,
  p_to        date
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
    and not public.is_blocked(auth.uid(), p_target_id)
    and (
      p_target_id = auth.uid()
      or h.visibility = 'public'
      or (h.visibility = 'friends'
          and public.are_friends(auth.uid(), p_target_id))
    )
    and o.occurrence_date >= p_from and o.occurrence_date < p_to;
$$;

grant execute on function public.get_user_overrides_range(uuid, date, date) to authenticated;

-- ─── 6. get_user_activity_heatmap ───────────────────────────────────────────

drop function if exists public.get_user_activity_heatmap(uuid, uuid, date, date, uuid);

create function public.get_user_activity_heatmap(
  p_target_id        uuid,
  p_from_date        date,
  p_to_date          date,
  p_habit_lineage_id uuid default null
)
returns table (activity_date date, completion_count int)
language sql stable
security definer
set search_path = public
as $$
  select
    coalesce(c.occurrence_date, c.period_start, c.completed_at::date) as activity_date,
    count(*)::int as completion_count
  from public.habit_completions c
  join public.habits h on h.id = c.habit_id
  where c.owner_id = p_target_id
    and not public.is_blocked(auth.uid(), p_target_id)
    and (
      p_target_id = auth.uid()
      or coalesce(c.visibility_override, h.visibility) = 'public'
      or (coalesce(c.visibility_override, h.visibility) = 'friends'
          and public.are_friends(auth.uid(), p_target_id))
    )
    and (p_habit_lineage_id is null or h.lineage_id = p_habit_lineage_id)
    and coalesce(c.occurrence_date, c.period_start, c.completed_at::date)
        between p_from_date and p_to_date
  group by 1
  order by 1;
$$;

grant execute on function public.get_user_activity_heatmap(uuid, date, date, uuid)
  to authenticated;

-- ─── 7. get_user_profile_page ───────────────────────────────────────────────

drop function if exists public.get_user_profile_page(uuid, uuid);

create function public.get_user_profile_page(
  p_target_id uuid
)
returns table (
  id                 uuid,
  handle             citext,
  avatar_url         text,
  friendship_status  text,
  friends_since      timestamptz,
  mutual_friend_count int
)
language sql stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.handle,
    p.avatar_url,
    case
      when p_target_id = auth.uid() then 'self'
      when exists (
        select 1 from public.friendships f
        where f.user_a = least(auth.uid(), p.id)
          and f.user_b = greatest(auth.uid(), p.id)
      ) then 'friend'
      when exists (
        select 1 from public.friend_requests fr
        where fr.status = 'pending'
          and fr.from_user = auth.uid() and fr.to_user = p.id
      ) then 'pending_outgoing'
      when exists (
        select 1 from public.friend_requests fr
        where fr.status = 'pending'
          and fr.from_user = p.id and fr.to_user = auth.uid()
      ) then 'pending_incoming'
      else 'none'
    end as friendship_status,
    (
      select f.created_at from public.friendships f
      where f.user_a = least(auth.uid(), p.id)
        and f.user_b = greatest(auth.uid(), p.id)
    ) as friends_since,
    (
      select count(*)::int
      from public.friendships f1
      join public.friendships f2
        on (case when f1.user_a = auth.uid() then f1.user_b else f1.user_a end)
         = (case when f2.user_a = p_target_id then f2.user_b else f2.user_a end)
      where (f1.user_a = auth.uid() or f1.user_b = auth.uid())
        and (f2.user_a = p_target_id or f2.user_b = p_target_id)
    ) as mutual_friend_count
  from public.profiles p
  where p.id = p_target_id
    and not public.is_blocked(auth.uid(), p_target_id);
$$;

grant execute on function public.get_user_profile_page(uuid) to authenticated;

-- ─── 8. get_mutual_friends ──────────────────────────────────────────────────
-- Was (p_user_a, p_user_b) — both arbitrary, letting anyone enumerate any two
-- users' mutual friends. Now one side is always the caller (auth.uid()); every
-- caller already passed (viewer, target) in that order.

drop function if exists public.get_mutual_friends(uuid, uuid, int);

create function public.get_mutual_friends(
  p_target_id uuid,
  p_limit     int default 10
)
returns table (
  id          uuid,
  handle      citext,
  avatar_url  text
)
language sql stable
security definer
set search_path = public
as $$
  with friends_of_viewer as (
    select case when f.user_a = auth.uid() then f.user_b else f.user_a end as fid
    from public.friendships f
    where f.user_a = auth.uid() or f.user_b = auth.uid()
  ),
  friends_of_target as (
    select case when f.user_a = p_target_id then f.user_b else f.user_a end as fid
    from public.friendships f
    where f.user_a = p_target_id or f.user_b = p_target_id
  )
  select p.id, p.handle, p.avatar_url
  from friends_of_viewer a
  join friends_of_target b on a.fid = b.fid
  join public.profiles p on p.id = a.fid
  where not public.is_blocked(auth.uid(), a.fid)
    and not public.is_blocked(p_target_id, a.fid)
  order by p.handle asc
  limit greatest(p_limit, 1);
$$;

grant execute on function public.get_mutual_friends(uuid, int) to authenticated;
