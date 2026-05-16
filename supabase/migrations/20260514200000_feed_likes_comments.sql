-- ============================================================================
-- Feed feature: likes, comments, comment-likes, moderation primitives, push
-- token plumbing, and a single-RPC page reader. See /FEED_PLAN.md.
-- ============================================================================


-- ─── completion_likes ──────────────────────────────────────────────────────

create table public.completion_likes (
  completion_id  uuid not null references public.habit_completions(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (completion_id, user_id)
);

create index completion_likes_completion_idx on public.completion_likes (completion_id);
create index completion_likes_user_idx       on public.completion_likes (user_id);

alter table public.completion_likes enable row level security;

create policy completion_likes_select on public.completion_likes for select
  using (
    public.can_view_completion(auth.uid(), completion_id)
    and not public.is_blocked(auth.uid(), user_id)
  );

create policy completion_likes_insert on public.completion_likes for insert
  with check (
    auth.uid() = user_id
    and public.can_view_completion(auth.uid(), completion_id)
  );

create policy completion_likes_delete on public.completion_likes for delete
  using (auth.uid() = user_id);


-- ─── completion_comments ───────────────────────────────────────────────────

create table public.completion_comments (
  id             uuid primary key default gen_random_uuid(),
  completion_id  uuid not null references public.habit_completions(id) on delete cascade,
  author_id      uuid not null references public.profiles(id) on delete cascade,
  body           text not null check (char_length(body) between 1 and 500),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index completion_comments_completion_idx
  on public.completion_comments (completion_id, created_at);
create index completion_comments_author_idx
  on public.completion_comments (author_id);

create trigger completion_comments_updated_at
  before update on public.completion_comments
  for each row execute function public.set_updated_at();

alter table public.completion_comments enable row level security;

create policy completion_comments_select on public.completion_comments for select
  using (
    public.can_view_completion(auth.uid(), completion_id)
    and not public.is_blocked(auth.uid(), author_id)
  );

create policy completion_comments_insert on public.completion_comments for insert
  with check (
    auth.uid() = author_id
    and public.can_view_completion(auth.uid(), completion_id)
  );

create policy completion_comments_update on public.completion_comments for update
  using (auth.uid() = author_id) with check (auth.uid() = author_id);

-- Author may delete own comment; completion owner may delete any comment on
-- their post (moderation / App Store compliance).
create policy completion_comments_delete on public.completion_comments for delete
  using (
    auth.uid() = author_id
    or exists (
      select 1 from public.habit_completions c
      where c.id = completion_id and c.owner_id = auth.uid()
    )
  );


-- ─── comment_likes ─────────────────────────────────────────────────────────

create table public.comment_likes (
  comment_id  uuid not null references public.completion_comments(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create index comment_likes_comment_idx on public.comment_likes (comment_id);
create index comment_likes_user_idx    on public.comment_likes (user_id);

alter table public.comment_likes enable row level security;

create policy comment_likes_select on public.comment_likes for select
  using (
    exists (
      select 1 from public.completion_comments cc
      where cc.id = comment_id
        and public.can_view_completion(auth.uid(), cc.completion_id)
        and not public.is_blocked(auth.uid(), cc.author_id)
    )
    and not public.is_blocked(auth.uid(), user_id)
  );

create policy comment_likes_insert on public.comment_likes for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.completion_comments cc
      where cc.id = comment_id
        and public.can_view_completion(auth.uid(), cc.completion_id)
    )
  );

create policy comment_likes_delete on public.comment_likes for delete
  using (auth.uid() = user_id);


-- ─── Moderation: content_reports, muted_habits ─────────────────────────────

create type report_target_kind as enum ('completion', 'comment');

create table public.content_reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid not null references public.profiles(id) on delete cascade,
  target_kind  report_target_kind not null,
  target_id    uuid not null,
  reason       text check (reason is null or char_length(reason) <= 1000),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);

create index content_reports_reporter_idx on public.content_reports (reporter_id);
create index content_reports_target_idx   on public.content_reports (target_kind, target_id);

alter table public.content_reports enable row level security;

create policy content_reports_select on public.content_reports for select
  using (auth.uid() = reporter_id);
create policy content_reports_insert on public.content_reports for insert
  with check (auth.uid() = reporter_id);

create table public.muted_habits (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  habit_id    uuid not null references public.habits(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, habit_id)
);

create index muted_habits_user_idx on public.muted_habits (user_id);

alter table public.muted_habits enable row level security;

create policy muted_habits_select on public.muted_habits for select
  using (auth.uid() = user_id);
create policy muted_habits_modify on public.muted_habits for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ─── expo_push_tokens ──────────────────────────────────────────────────────

create table public.expo_push_tokens (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  token       text not null,
  device_id   text,
  platform    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, token)
);

create index expo_push_tokens_user_idx on public.expo_push_tokens (user_id);

create trigger expo_push_tokens_updated_at
  before update on public.expo_push_tokens
  for each row execute function public.set_updated_at();

alter table public.expo_push_tokens enable row level security;

create policy expo_push_tokens_select on public.expo_push_tokens for select
  using (auth.uid() = user_id);
create policy expo_push_tokens_modify on public.expo_push_tokens for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ─── Feed: drop friend_feed view, add fetch_feed_page RPC ──────────────────

drop view if exists public.friend_feed;

-- Returns one page of feed items for the calling user. Keyset cursor uses
-- (completed_at, id) for stable ordering across ties.
--
-- LIMIT is pushed into a CTE so the per-row aggregates (attachments,
-- like_count, comment_count, viewer_liked) only run for the page's 20 rows,
-- not for every completion ever. RLS on the base tables still gates
-- visibility — this function does not run as security definer.
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
      and not exists (
        select 1 from public.muted_habits m
        where m.user_id = auth.uid() and m.habit_id = c.habit_id
      )
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
                   ) order by a.created_at)
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

grant execute on function public.fetch_feed_page(timestamptz, uuid, int) to authenticated;


-- ─── Comments page reader ──────────────────────────────────────────────────

create or replace function public.fetch_comments_page(
  target_completion_id uuid,
  cursor_created_at    timestamptz default null,
  cursor_id            uuid        default null,
  page_limit           int         default 50
)
returns table (
  id                   uuid,
  completion_id        uuid,
  author_id            uuid,
  author_handle        citext,
  author_display_name  text,
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
    select cc.*
    from public.completion_comments cc
    where cc.completion_id = target_completion_id
      and (
        cursor_created_at is null
        or (cc.created_at, cc.id) > (cursor_created_at, cursor_id)
      )
    order by cc.created_at asc, cc.id asc
    limit greatest(page_limit, 1)
  )
  select page.id,
         page.completion_id,
         page.author_id,
         p.handle,
         p.display_name,
         p.avatar_url,
         page.body,
         page.created_at,
         page.updated_at,
         (select count(*)::int
            from public.comment_likes cl
            where cl.comment_id = page.id) as like_count,
         exists (
           select 1 from public.comment_likes cl
           where cl.comment_id = page.id and cl.user_id = auth.uid()
         ) as viewer_liked
  from page
  join public.profiles p on p.id = page.author_id
  order by page.created_at asc, page.id asc;
$$;

grant execute on function public.fetch_comments_page(uuid, timestamptz, uuid, int) to authenticated;


-- ─── Likers page reader (works for both completion-likes + comment-likes) ──

create type like_target_kind as enum ('completion', 'comment');

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
  display_name  text,
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
         p.display_name,
         p.avatar_url,
         page.liked_at
  from page
  join public.profiles p on p.id = page.user_id
  order by page.liked_at desc, page.user_id desc;
$$;

grant execute on function public.fetch_likers_page(like_target_kind, uuid, timestamptz, uuid, int) to authenticated;


-- ─── Documentation ─────────────────────────────────────────────────────────

comment on table public.completion_likes is
  'A user''s heart on a habit completion. Unique per (completion_id, user_id).';
comment on table public.completion_comments is
  'Flat-list comments on a habit completion. 1-500 chars. No threading in v1.';
comment on table public.comment_likes is
  'A user''s heart on a comment. Unique per (comment_id, user_id).';
comment on table public.content_reports is
  'User-flagged content (completion or comment) for moderation. Per App Store Guideline 1.2.';
comment on table public.muted_habits is
  'Per-user mute list of habits whose completions should not appear in their feed.';
comment on table public.expo_push_tokens is
  'Expo push tokens registered per device. Used by notify-on-engagement edge function.';

comment on function public.fetch_feed_page(timestamptz, uuid, int) is
  'Single-round-trip feed page. Keyset cursor on (completed_at, id) desc.';
comment on function public.fetch_comments_page(uuid, timestamptz, uuid, int) is
  'Paginated comments for a completion, ascending by created_at.';
comment on function public.fetch_likers_page(like_target_kind, uuid, timestamptz, uuid, int) is
  'Paginated likers for a completion or a comment, descending by liked_at.';
