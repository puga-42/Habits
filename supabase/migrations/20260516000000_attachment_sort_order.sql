-- Add sort_order to completion_attachments for user-controlled carousel ordering.

alter table public.completion_attachments
  add column sort_order smallint not null default 0;

-- Backfill existing rows: sort_order = row position by created_at per completion.
with ranked as (
  select id, row_number() over (
    partition by completion_id order by created_at
  ) - 1 as rn
  from public.completion_attachments
)
update public.completion_attachments a
  set sort_order = ranked.rn
  from ranked
  where a.id = ranked.id;

-- Update fetch_feed_page: order attachments by sort_order instead of created_at.
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
  note                 text,
  visibility_override  habit_visibility,
  owner_handle         citext,
  owner_display_name   text,
  owner_avatar_url     text,
  habit_title          text,
  habit_icon           text,
  habit_color          text,
  habit_kind           habit_kind,
  attachments          jsonb,
  like_count           int,
  comment_count        int,
  viewer_liked         boolean
)
language sql stable
as $$
  with page as (
    select c.*
    from public.habit_completions c
    where (c.owner_id = auth.uid()
           or public.are_friends(auth.uid(), c.owner_id))
      and (
        cursor_completed_at is null
        or (c.completed_at, c.id) < (cursor_completed_at, cursor_id)
      )
    order by c.completed_at desc, c.id desc
    limit greatest(page_limit, 1)
  )
  select page.id,
         page.habit_id,
         page.owner_id,
         page.occurrence_date,
         page.period_start,
         page.completed_at,
         page.note,
         page.visibility_override,
         p.handle,
         p.display_name,
         p.avatar_url,
         h.title,
         h.icon,
         h.color,
         h.kind,
         coalesce(
           (select jsonb_agg(jsonb_build_object(
                     'id',               a.id,
                     'kind',             a.kind,
                     'storage_path',     a.storage_path,
                     'mime_type',        a.mime_type,
                     'width',            a.width,
                     'height',           a.height,
                     'duration_seconds', a.duration_seconds
                   ) order by a.sort_order)
            from public.completion_attachments a
            where a.completion_id = page.id),
           '[]'::jsonb
         ) as attachments,
         (select count(*)::int
            from public.completion_likes l
            where l.completion_id = page.id) as like_count,
         (select count(*)::int
            from public.completion_comments cc
            where cc.completion_id = page.id) as comment_count,
         exists (
           select 1 from public.completion_likes l
           where l.completion_id = page.id and l.user_id = auth.uid()
         ) as viewer_liked
  from page
  join public.profiles p on p.id = page.owner_id
  join public.habits   h on h.id = page.habit_id
  order by page.completed_at desc, page.id desc;
$$;
