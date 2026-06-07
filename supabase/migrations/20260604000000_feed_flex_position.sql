-- Add flex_position and flex_target to the feed RPC so the feed card can
-- display "completed Meditate 2/5" for flex habits.

drop function if exists public.fetch_feed_page(timestamptz, uuid, int);

create or replace function public.fetch_feed_page(
  cursor_completed_at timestamptz default null,
  cursor_id           uuid        default null,
  page_limit          int         default 20
)
returns table (
  id                   uuid,
  habit_id             uuid,
  owner_id             uuid,
  occurrence_date      date,
  period_start         date,
  completed_at         timestamptz,
  created_at           timestamptz,
  note                 text,
  visibility_override  habit_visibility,
  owner_handle         citext,
  owner_avatar_url     text,
  habit_title          text,
  habit_icon           text,
  habit_color          text,
  habit_kind           habit_kind,
  attachments          jsonb,
  like_count           int,
  comment_count        int,
  viewer_liked         boolean,
  feed_kind            text,
  flex_position        int,
  flex_target          int
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
           else null end as flex_position
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
           null::int as flex_position
    from public.habit_activity a
    join public.habits h on h.id = a.habit_id
    where a.event_type = 'created'
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
         h.target_count as flex_target
  from page
  join public.profiles p on p.id = page.owner_id
  join public.habits   h on h.id = page.habit_id
  order by page.sort_ts desc, page.id desc;
$$;
