-- Surface rest posts in the feed, and read their comments + likers. Recreates
-- fetch_feed_page with a third 'rest' union branch and per-kind arms for
-- attachments/likes/comments; adds fetch_rest_comments_page (mirrors
-- fetch_activity_comments_page); extends fetch_likers_page with a 'rest' branch.
-- Signatures are unchanged, so create-or-replace is sufficient. Additive only.

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

    union all

    -- Rest posts. Fine-grained visibility is enforced by RLS (can_view_rest on
    -- habit_rests), so here we only apply the coarse owner-or-friend, muted, and
    -- cursor filters — mirroring the completion branch.
    select r.id,
           r.habit_id,
           r.owner_id,
           null::date as occurrence_date,
           null::date as period_start,
           null::timestamptz as completed_at,
           r.created_at,
           r.note,
           r.visibility_override,
           r.created_at as sort_ts,
           'rest'::text as feed_kind,
           null::int as flex_position,
           null::text as event_type,
           null::uuid as adopted_from_user_id
    from public.habit_rests r
    join public.habits h on h.id = r.habit_id
    where h.deleted_at is null
      and (r.owner_id = auth.uid()
           or public.are_friends(auth.uid(), r.owner_id))
      and not exists (
        select 1 from public.muted_habits m
        where m.user_id = auth.uid() and m.habit_id = r.habit_id
      )
      and (
        cursor_completed_at is null
        or (r.created_at, r.id) < (cursor_completed_at, cursor_id)
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
         case
           when page.feed_kind = 'completion' then
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
           when page.feed_kind = 'rest' then
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
                from public.rest_attachments att
                where att.rest_id = page.id),
               '[]'::jsonb
             )
           else '[]'::jsonb
         end as attachments,
         case
           when page.feed_kind = 'completion' then
             (select count(*)::int from public.completion_likes l
               where l.completion_id = page.id)
           when page.feed_kind = 'rest' then
             (select count(*)::int from public.rest_likes l
               where l.rest_id = page.id)
           else
             (select count(*)::int from public.activity_likes l
               where l.activity_id = page.id)
         end as like_count,
         case
           when page.feed_kind = 'completion' then
             (select count(*)::int from public.completion_comments cc
               where cc.completion_id = page.id)
           when page.feed_kind = 'rest' then
             (select count(*)::int from public.rest_comments rc
               where rc.rest_id = page.id)
           else
             (select count(*)::int from public.activity_comments ac
               where ac.activity_id = page.id)
         end as comment_count,
         case
           when page.feed_kind = 'completion' then
             exists (select 1 from public.completion_likes l
               where l.completion_id = page.id and l.user_id = auth.uid())
           when page.feed_kind = 'rest' then
             exists (select 1 from public.rest_likes l
               where l.rest_id = page.id and l.user_id = auth.uid())
           else
             exists (select 1 from public.activity_likes l
               where l.activity_id = page.id and l.user_id = auth.uid())
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

-- ─── rest comments page reader (mirrors fetch_activity_comments_page) ────────

create or replace function public.fetch_rest_comments_page(
  target_rest_id    uuid,
  cursor_created_at timestamptz default null,
  cursor_id         uuid        default null,
  page_limit        int         default 50
)
returns table (
  id                   uuid,
  rest_id              uuid,
  author_id            uuid,
  author_handle        citext,
  author_avatar_url    text,
  body                 text,
  created_at           timestamptz,
  updated_at           timestamptz,
  like_count           int,
  viewer_liked         boolean
)
language sql stable
as $$
  with page as (
    select rc.*
    from public.rest_comments rc
    where rc.rest_id = target_rest_id
      and (
        cursor_created_at is null
        or (rc.created_at, rc.id) > (cursor_created_at, cursor_id)
      )
    order by rc.created_at asc, rc.id asc
    limit greatest(page_limit, 1)
  )
  select page.id,
         page.rest_id,
         page.author_id,
         p.handle,
         p.avatar_url,
         page.body,
         page.created_at,
         page.updated_at,
         (select count(*)::int
            from public.rest_comment_likes cl
            where cl.comment_id = page.id) as like_count,
         exists (
           select 1 from public.rest_comment_likes cl
           where cl.comment_id = page.id and cl.user_id = auth.uid()
         ) as viewer_liked
  from page
  join public.profiles p on p.id = page.author_id
  order by page.created_at asc, page.id asc;
$$;

grant execute on function public.fetch_rest_comments_page(uuid, timestamptz, uuid, int) to authenticated;

-- ─── likers: add the 'rest' branch ──────────────────────────────────────────

create or replace function public.fetch_likers_page(
  target_kind        like_target_kind,
  target_id          uuid,
  cursor_liked_at    timestamptz default null,
  cursor_user_id     uuid        default null,
  page_limit         int         default 50
)
returns table (
  user_id       uuid,
  handle        citext,
  avatar_url    text,
  liked_at      timestamptz
)
language sql stable
as $$
  with raw as (
    select l.user_id, l.created_at as liked_at
    from public.completion_likes l
    where target_kind = 'completion' and l.completion_id = target_id
    union all
    select l.user_id, l.created_at as liked_at
    from public.comment_likes l
    where target_kind = 'comment' and l.comment_id = target_id
    union all
    select l.user_id, l.created_at as liked_at
    from public.activity_likes l
    where target_kind = 'activity' and l.activity_id = target_id
    union all
    select l.user_id, l.created_at as liked_at
    from public.rest_likes l
    where target_kind = 'rest' and l.rest_id = target_id
  ),
  page as (
    select * from raw
    where cursor_liked_at is null
       or (liked_at, user_id) < (cursor_liked_at, cursor_user_id)
    order by liked_at desc, user_id desc
    limit greatest(page_limit, 1)
  )
  select page.user_id,
         p.handle,
         p.avatar_url,
         page.liked_at
  from page
  join public.profiles p on p.id = page.user_id
  order by page.liked_at desc, page.user_id desc;
$$;

grant execute on function public.fetch_likers_page(like_target_kind, uuid, timestamptz, uuid, int) to authenticated;
