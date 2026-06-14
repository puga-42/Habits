-- Lineage schedule segments for streaks.
--
-- A habit is a LINEAGE of rows: a "This and future" edit forks a new habits row
-- (same lineage_id) with its own schedule era. The streak must expand EVERY era,
-- so the stats RPCs now ship a per-lineage `segments` array — one entry per
-- lineage row {rrule, dtstart, until, target_count, target_period}, ordered by
-- dtstart. Adding a column to a returns-table function requires drop+recreate;
-- existing migration files are left untouched (only new ones created).
--
-- The flat habit_rrule/dtstart/until/target_period columns on fetch_feed_page are
-- kept so an un-updated client still renders; the new clients prefer `segments`.

-- ─── shared helper: a lineage's schedule eras, oldest first ─────────────────
-- Defined first: the stats RPCs below reference it, and Postgres validates SQL
-- function bodies at creation time.

create or replace function public.lineage_segments(p_lineage_id uuid)
returns jsonb
language sql stable
set search_path = public
as $$
  select coalesce((
    select jsonb_agg(jsonb_build_object(
             'rrule',         seg.rrule,
             'dtstart',       seg.dtstart,
             'until',         seg.until,
             'target_count',  seg.target_count,
             'target_period', seg.target_period
           ) order by seg.dtstart asc nulls first)
    from public.habits seg
    where seg.lineage_id = p_lineage_id
  ), '[]'::jsonb);
$$;

-- ─── fetch_habit_stats — single lineage (overview) ──────────────────────────

drop function if exists public.fetch_habit_stats(uuid, uuid, uuid);

create or replace function public.fetch_habit_stats(
  p_target_id  uuid,
  p_viewer_id  uuid,
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
      and not public.is_blocked(p_viewer_id, p_target_id)
      and (
        p_target_id = p_viewer_id
        or h.visibility = 'public'
        or (h.visibility = 'friends'
            and public.are_friends(p_viewer_id, p_target_id))
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

grant execute on function public.fetch_habit_stats(uuid, uuid, uuid) to authenticated;

-- ─── fetch_my_habits_stats — every owned lineage (day-view) ─────────────────

drop function if exists public.fetch_my_habits_stats(uuid);

create or replace function public.fetch_my_habits_stats(
  p_viewer_id uuid
)
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
    where h.owner_id = p_viewer_id
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

grant execute on function public.fetch_my_habits_stats(uuid) to authenticated;

-- ─── fetch_feed_page — add habit_segments ───────────────────────────────────

drop function if exists public.fetch_feed_page(timestamptz, uuid, int);

create or replace function public.fetch_feed_page(
  cursor_completed_at timestamptz default null,
  cursor_id           uuid        default null,
  page_limit          int         default 20
)
returns table (
  id                    uuid,
  habit_id              uuid,
  owner_id              uuid,
  occurrence_date       date,
  period_start          date,
  completed_at          timestamptz,
  created_at            timestamptz,
  note                  text,
  visibility_override   habit_visibility,
  owner_handle          citext,
  owner_avatar_url      text,
  habit_title           text,
  habit_icon            text,
  habit_color           text,
  habit_kind            habit_kind,
  attachments           jsonb,
  like_count            int,
  comment_count         int,
  viewer_liked          boolean,
  feed_kind             text,
  flex_position         int,
  flex_target           int,
  event_type            text,
  adopted_from_handle   citext,
  habit_description     text,
  habit_lineage_id      uuid,
  completion_count      int,
  habit_rrule           text,
  habit_dtstart         timestamptz,
  habit_until           timestamptz,
  habit_target_period   text,
  completion_history    jsonb,
  skip_history          jsonb,
  habit_segments        jsonb
)
language sql stable
as $$
  with page as (
    select c.id,
           c.habit_id,
           c.owner_id,
           c.occurrence_date,
           c.period_start,
           c.completed_at,
           c.created_at,
           c.note,
           c.visibility_override,
           c.completed_at as sort_ts,
           'completion'::text as feed_kind,
           case when c.period_start is not null then
             row_number() over (
               partition by c.habit_id, c.period_start
               order by c.completed_at
             )::int
           else null end as flex_position,
           null::text as event_type,
           null::uuid as adopted_from_user_id
    from public.habit_completions c
    where (c.owner_id = auth.uid()
           or public.are_friends(auth.uid(), c.owner_id))
      and not exists (
        select 1 from public.muted_habits m
        where m.user_id = auth.uid() and m.habit_id = c.habit_id
      )
      and (
        cursor_completed_at is null
        or (c.completed_at, c.id) < (cursor_completed_at, cursor_id)
      )

    union all

    select a.id,
           a.habit_id,
           a.owner_id,
           null::date as occurrence_date,
           null::date as period_start,
           null::timestamptz as completed_at,
           a.created_at,
           null::text as note,
           null::habit_visibility as visibility_override,
           a.created_at as sort_ts,
           'habit_created'::text as feed_kind,
           null::int as flex_position,
           a.event_type,
           a.adopted_from_user_id
    from public.habit_activity a
    join public.habits h on h.id = a.habit_id
    where a.event_type in ('created', 'adopted')
      and h.deleted_at is null
      and (a.owner_id = auth.uid()
           or (public.are_friends(auth.uid(), a.owner_id)
               and not public.is_blocked(auth.uid(), a.owner_id)
               and h.visibility in ('public', 'friends')))
      and not exists (
        select 1 from public.muted_habits m
        where m.user_id = auth.uid() and m.habit_id = a.habit_id
      )
      and (
        cursor_completed_at is null
        or (a.created_at, a.id) < (cursor_completed_at, cursor_id)
      )

    order by sort_ts desc, id desc
    limit greatest(page_limit, 1)
  )
  select page.id,
         page.habit_id,
         page.owner_id,
         page.occurrence_date,
         page.period_start,
         page.completed_at,
         page.created_at,
         page.note,
         page.visibility_override,
         p.handle,
         p.avatar_url,
         h.title,
         h.icon,
         h.color,
         h.kind,
         case when page.feed_kind = 'completion' then
           coalesce(
             (select jsonb_agg(jsonb_build_object(
                       'id',               att.id,
                       'kind',             att.kind,
                       'storage_path',     att.storage_path,
                       'mime_type',        att.mime_type,
                       'width',            att.width,
                       'height',           att.height,
                       'duration_seconds', att.duration_seconds
                     ) order by att.sort_order)
              from public.completion_attachments att
              where att.completion_id = page.id),
             '[]'::jsonb
           )
         else '[]'::jsonb
         end as attachments,
         case when page.feed_kind = 'completion' then
           (select count(*)::int
              from public.completion_likes l
              where l.completion_id = page.id)
         else
           (select count(*)::int
              from public.activity_likes l
              where l.activity_id = page.id)
         end as like_count,
         case when page.feed_kind = 'completion' then
           (select count(*)::int
              from public.completion_comments cc
              where cc.completion_id = page.id)
         else
           (select count(*)::int
              from public.activity_comments ac
              where ac.activity_id = page.id)
         end as comment_count,
         case when page.feed_kind = 'completion' then
           exists (
             select 1 from public.completion_likes l
             where l.completion_id = page.id and l.user_id = auth.uid()
           )
         else
           exists (
             select 1 from public.activity_likes l
             where l.activity_id = page.id and l.user_id = auth.uid()
           )
         end as viewer_liked,
         page.feed_kind,
         page.flex_position,
         h.target_count as flex_target,
         page.event_type,
         afp.handle as adopted_from_handle,
         h.description as habit_description,
         h.lineage_id as habit_lineage_id,
         (select count(*)::int
            from public.habit_completions hc
            join public.habits hh on hh.id = hc.habit_id
           where hh.lineage_id = h.lineage_id) as completion_count,
         h.rrule as habit_rrule,
         h.dtstart as habit_dtstart,
         h.until as habit_until,
         h.target_period::text as habit_target_period,
         coalesce((
           select jsonb_agg(t.d order by t.d desc)
           from (
             select coalesce(hc.occurrence_date, hc.period_start) as d
             from public.habit_completions hc
             join public.habits hh on hh.id = hc.habit_id
             where hh.lineage_id = h.lineage_id
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
             where hh.lineage_id = h.lineage_id and ho.kind = 'skip'
             order by ho.occurrence_date desc
             limit 100
           ) s
         ), '[]'::jsonb) as skip_history,
         public.lineage_segments(h.lineage_id) as habit_segments
  from page
  join public.profiles p on p.id = page.owner_id
  join public.habits   h on h.id = page.habit_id
  left join public.profiles afp on afp.id = page.adopted_from_user_id
  order by page.sort_ts desc, page.id desc;
$$;

grant execute on function public.fetch_feed_page(timestamptz, uuid, int) to authenticated;
