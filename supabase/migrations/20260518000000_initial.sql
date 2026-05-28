-- ============================================================================
-- Squashed initial schema for the Habits app.
-- See /CONTEXT.md for vocabulary, schema rationale, and visibility rules.
-- ============================================================================


-- ─── Extensions ─────────────────────────────────────────────────────────────

create extension if not exists citext;


-- ─── Enums ──────────────────────────────────────────────────────────────────

create type habit_kind             as enum ('scheduled', 'flex');
create type habit_visibility       as enum ('public', 'friends', 'private');
create type flex_period            as enum ('day', 'week', 'month');
create type override_kind          as enum ('skip', 'reschedule', 'edit');
create type attachment_kind        as enum ('photo', 'video');
create type friend_request_status  as enum ('pending', 'accepted', 'declined');
create type report_target_kind     as enum ('completion', 'comment');
create type like_target_kind       as enum ('completion', 'comment', 'activity');


-- ─── profiles ───────────────────────────────────────────────────────────────

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  handle      citext unique not null,
  avatar_url  text,
  week_start  smallint not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint profiles_handle_format check (handle ~ '^[a-zA-Z0-9_]{3,30}$'),
  constraint profiles_week_start_range check (week_start between 0 and 6)
);


-- ─── Social graph: friendships, friend_requests, blocks ─────────────────────

create table public.friendships (
  user_a      uuid not null references public.profiles(id) on delete cascade,
  user_b      uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);

create index friendships_user_b_idx on public.friendships (user_b);

create table public.friend_requests (
  id            uuid primary key default gen_random_uuid(),
  from_user     uuid not null references public.profiles(id) on delete cascade,
  to_user       uuid not null references public.profiles(id) on delete cascade,
  status        friend_request_status not null default 'pending',
  created_at    timestamptz not null default now(),
  responded_at  timestamptz,
  check (from_user != to_user)
);

create unique index friend_requests_unique_pending
  on public.friend_requests (least(from_user, to_user), greatest(from_user, to_user))
  where status = 'pending';

create index friend_requests_to_user_idx on public.friend_requests (to_user);

create index friend_requests_pending_to_idx
  on public.friend_requests (to_user)
  where status = 'pending';

create table public.blocks (
  blocker_id  uuid not null references public.profiles(id) on delete cascade,
  blocked_id  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id != blocked_id)
);

create index blocks_blocked_id_idx on public.blocks (blocked_id);


-- ─── habits + habit_overrides ───────────────────────────────────────────────

create table public.habits (
  id           uuid primary key default gen_random_uuid(),
  lineage_id   uuid not null,
  owner_id     uuid not null references public.profiles(id) on delete cascade,

  kind         habit_kind not null,
  title        text not null check (char_length(title) between 1 and 100),
  description  text,
  color        text,
  icon         text,
  visibility   habit_visibility not null default 'private',
  timezone     text not null,

  -- scheduled-only
  dtstart      timestamptz,
  rrule        text,
  until        timestamptz,

  -- flex-only
  target_count   int,
  target_period  flex_period,

  sort_index  integer not null default 0,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,

  check (
    (kind = 'scheduled'
       and dtstart is not null and rrule is not null
       and target_count is null and target_period is null)
    or
    (kind = 'flex'
       and target_count is not null and target_count > 0 and target_period is not null
       and dtstart is null and rrule is null and until is null)
  )
);

create index habits_owner_idx      on public.habits (owner_id);
create index habits_lineage_idx    on public.habits (lineage_id);
create index habits_visibility_idx on public.habits (visibility);
create index habits_owner_sort_idx on public.habits (owner_id, sort_index, created_at);

create table public.habit_overrides (
  id               uuid primary key default gen_random_uuid(),
  habit_id         uuid not null references public.habits(id) on delete cascade,
  occurrence_date  date not null,
  kind             override_kind not null,
  patch            jsonb,
  created_at       timestamptz not null default now(),
  unique (habit_id, occurrence_date)
);

create index habit_overrides_habit_idx on public.habit_overrides (habit_id);


-- ─── completions + attachments ──────────────────────────────────────────────

create table public.habit_completions (
  id                   uuid primary key default gen_random_uuid(),
  habit_id             uuid not null references public.habits(id) on delete cascade,
  owner_id             uuid not null references public.profiles(id) on delete cascade,

  occurrence_date      date,
  period_start         date,
  completed_at         timestamptz not null default now(),
  note                 text check (note is null or char_length(note) <= 2000),
  visibility_override  habit_visibility,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  check (
    (occurrence_date is not null and period_start is null)
    or
    (occurrence_date is null and period_start is not null)
  )
);

create index habit_completions_habit_idx     on public.habit_completions (habit_id);
create index habit_completions_owner_idx     on public.habit_completions (owner_id);
create index habit_completions_completed_idx on public.habit_completions (completed_at desc);

create table public.completion_attachments (
  id                uuid primary key default gen_random_uuid(),
  completion_id     uuid not null references public.habit_completions(id) on delete cascade,
  owner_id          uuid not null references public.profiles(id) on delete cascade,
  kind              attachment_kind not null,
  storage_path      text not null,
  mime_type         text not null,
  byte_size         bigint not null check (byte_size > 0),
  duration_seconds  int check (duration_seconds is null or duration_seconds > 0),
  width             int check (width is null or width > 0),
  height            int check (height is null or height > 0),
  sort_order        smallint not null default 0,
  created_at        timestamptz not null default now(),

  constraint attachments_video_constraints check (
    (kind = 'photo' and duration_seconds is null)
    or
    (kind = 'video' and duration_seconds is not null
       and duration_seconds <= 30
       and byte_size <= 52428800)
  )
);

create index completion_attachments_completion_idx on public.completion_attachments (completion_id);


-- ─── Feed: likes, comments, comment-likes ───────────────────────────────────

create table public.completion_likes (
  completion_id  uuid not null references public.habit_completions(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (completion_id, user_id)
);

create index completion_likes_completion_idx on public.completion_likes (completion_id);
create index completion_likes_user_idx       on public.completion_likes (user_id);

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

create table public.comment_likes (
  comment_id  uuid not null references public.completion_comments(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create index comment_likes_comment_idx on public.comment_likes (comment_id);
create index comment_likes_user_idx    on public.comment_likes (user_id);


-- ─── Moderation: content_reports, muted_habits ──────────────────────────────

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

create table public.muted_habits (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  habit_id    uuid not null references public.habits(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, habit_id)
);

create index muted_habits_user_idx on public.muted_habits (user_id);


-- ─── expo_push_tokens ───────────────────────────────────────────────────────

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


-- ─── feedback ───────────────────────────────────────────────────────────────

create table public.feedback (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid references auth.users(id) not null,
  status               text not null default 'pending'
                         check (status in ('pending', 'processing', 'done', 'failed')),
  category             text check (category in ('bug', 'feature')),
  title                text,
  github_issue_number  int,
  processed_at         timestamptz,
  created_at           timestamptz not null default now()
);


-- ─── habit_activity (habit-created events for the social feed) ──────────────

create table public.habit_activity (
  id          uuid        primary key default gen_random_uuid(),
  habit_id    uuid        not null references public.habits(id) on delete cascade,
  owner_id    uuid        not null references public.profiles(id) on delete cascade,
  event_type  text        not null default 'created',
  created_at  timestamptz not null default now(),

  constraint habit_activity_event_type_check
    check (event_type in ('created'))
);

create index habit_activity_created_at_idx on public.habit_activity (created_at desc);
create index habit_activity_owner_idx      on public.habit_activity (owner_id);

create table public.activity_likes (
  activity_id  uuid not null references public.habit_activity(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (activity_id, user_id)
);

create index activity_likes_activity_idx on public.activity_likes (activity_id);
create index activity_likes_user_idx     on public.activity_likes (user_id);

create table public.activity_comments (
  id           uuid primary key default gen_random_uuid(),
  activity_id  uuid not null references public.habit_activity(id) on delete cascade,
  author_id    uuid not null references public.profiles(id) on delete cascade,
  body         text not null check (char_length(body) between 1 and 500),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index activity_comments_activity_idx
  on public.activity_comments (activity_id, created_at);
create index activity_comments_author_idx
  on public.activity_comments (author_id);

create table public.activity_comment_likes (
  comment_id  uuid not null references public.activity_comments(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create index activity_comment_likes_comment_idx on public.activity_comment_likes (comment_id);
create index activity_comment_likes_user_idx    on public.activity_comment_likes (user_id);


-- ─── Triggers: updated_at, lineage default, visibility narrow ───────────────

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger habits_updated_at
  before update on public.habits
  for each row execute function public.set_updated_at();

create trigger habit_completions_updated_at
  before update on public.habit_completions
  for each row execute function public.set_updated_at();

create trigger completion_comments_updated_at
  before update on public.completion_comments
  for each row execute function public.set_updated_at();

create trigger expo_push_tokens_updated_at
  before update on public.expo_push_tokens
  for each row execute function public.set_updated_at();

create trigger activity_comments_updated_at
  before update on public.activity_comments
  for each row execute function public.set_updated_at();

create or replace function public.set_habit_lineage()
returns trigger language plpgsql as $$
begin
  if new.lineage_id is null then
    new.lineage_id := new.id;
  end if;
  return new;
end;
$$;

create trigger habits_set_lineage
  before insert on public.habits
  for each row execute function public.set_habit_lineage();

create or replace function public.validate_completion_visibility()
returns trigger language plpgsql as $$
declare
  parent_visibility habit_visibility;
begin
  if new.visibility_override is null then
    return new;
  end if;

  select visibility into parent_visibility
  from public.habits where id = new.habit_id;

  if parent_visibility is null then
    raise exception 'habit not found for completion';
  end if;

  if parent_visibility = 'private' then
    raise exception 'cannot override visibility on a private habit';
  end if;
  if parent_visibility = 'friends' and new.visibility_override != 'private' then
    raise exception 'visibility_override on a friends habit can only narrow to private';
  end if;
  if parent_visibility = 'public' and new.visibility_override not in ('friends', 'private') then
    raise exception 'visibility_override on a public habit can only narrow to friends or private';
  end if;

  return new;
end;
$$;

create trigger habit_completions_validate_visibility
  before insert or update on public.habit_completions
  for each row execute function public.validate_completion_visibility();


-- ─── Auto-create profile on signup ──────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base text;
  candidate text;
begin
  base := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
  candidate := base;

  while exists (select 1 from public.profiles where handle = candidate) loop
    candidate := base || '_' || floor(random() * 100000)::int;
  end loop;

  insert into public.profiles (id, handle)
  values (new.id, candidate);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ─── Auto-insert activity on habit creation ─────────────────────────────────

create or replace function public.insert_habit_created_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.habit_activity (habit_id, owner_id, event_type)
  values (new.id, new.owner_id, 'created');
  return new;
end;
$$;

create trigger trg_habit_created_activity
  after insert on public.habits
  for each row execute function public.insert_habit_created_activity();


-- ─── Helper functions used by RLS ───────────────────────────────────────────

create or replace function public.are_friends(u1 uuid, u2 uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.friendships
    where user_a = least(u1, u2) and user_b = greatest(u1, u2)
  );
$$;

create or replace function public.is_blocked(viewer uuid, target uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = viewer and blocked_id = target)
       or (blocker_id = target and blocked_id = viewer)
  );
$$;

create or replace function public.can_view_habit(viewer uuid, habit_id_param uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when h.owner_id = viewer then true
    when public.is_blocked(viewer, h.owner_id) then false
    when h.visibility = 'public' then true
    when h.visibility = 'friends' then public.are_friends(viewer, h.owner_id)
    else false
  end
  from public.habits h where h.id = habit_id_param;
$$;

create or replace function public.can_view_completion(viewer uuid, completion_id_param uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when c.owner_id = viewer then true
    when public.is_blocked(viewer, c.owner_id) then false
    when coalesce(c.visibility_override, h.visibility) = 'public' then true
    when coalesce(c.visibility_override, h.visibility) = 'friends'
      then public.are_friends(viewer, c.owner_id)
    else false
  end
  from public.habit_completions c
  join public.habits h on h.id = c.habit_id
  where c.id = completion_id_param;
$$;

create or replace function public.can_view_activity(
  viewer uuid,
  activity_id_param uuid
)
returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when a.owner_id = viewer then true
    when public.is_blocked(viewer, a.owner_id) then false
    when h.visibility = 'public' then true
    when h.visibility = 'friends' then public.are_friends(viewer, a.owner_id)
    else false
  end
  from public.habit_activity a
  join public.habits h on h.id = a.habit_id
  where a.id = activity_id_param
    and h.deleted_at is null;
$$;


-- ─── Enable RLS on every table ──────────────────────────────────────────────

alter table public.profiles               enable row level security;
alter table public.friendships            enable row level security;
alter table public.friend_requests        enable row level security;
alter table public.blocks                 enable row level security;
alter table public.habits                 enable row level security;
alter table public.habit_overrides        enable row level security;
alter table public.habit_completions      enable row level security;
alter table public.completion_attachments enable row level security;
alter table public.completion_likes       enable row level security;
alter table public.completion_comments    enable row level security;
alter table public.comment_likes          enable row level security;
alter table public.content_reports        enable row level security;
alter table public.muted_habits           enable row level security;
alter table public.expo_push_tokens       enable row level security;
alter table public.feedback               enable row level security;
alter table public.habit_activity         enable row level security;
alter table public.activity_likes         enable row level security;
alter table public.activity_comments      enable row level security;
alter table public.activity_comment_likes enable row level security;


-- ─── RLS policies ───────────────────────────────────────────────────────────

-- profiles
create policy profiles_select on public.profiles for select
  using (auth.uid() = id or not public.is_blocked(auth.uid(), id));
create policy profiles_insert on public.profiles for insert
  with check (auth.uid() = id);
create policy profiles_update on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);
create policy profiles_delete on public.profiles for delete
  using (auth.uid() = id);

-- friendships
create policy friendships_select on public.friendships for select
  using (auth.uid() in (user_a, user_b));
create policy friendships_insert on public.friendships for insert
  with check (auth.uid() in (user_a, user_b));
create policy friendships_delete on public.friendships for delete
  using (auth.uid() in (user_a, user_b));

-- friend_requests
create policy friend_requests_select on public.friend_requests for select
  using (auth.uid() in (from_user, to_user));
create policy friend_requests_insert on public.friend_requests for insert
  with check (
    auth.uid() = from_user
    and not public.is_blocked(from_user, to_user)
  );
create policy friend_requests_update on public.friend_requests for update
  using (auth.uid() in (from_user, to_user))
  with check (auth.uid() in (from_user, to_user));
create policy friend_requests_delete on public.friend_requests for delete
  using (auth.uid() in (from_user, to_user));

-- blocks
create policy blocks_select on public.blocks for select
  using (auth.uid() = blocker_id);
create policy blocks_insert on public.blocks for insert
  with check (auth.uid() = blocker_id);
create policy blocks_delete on public.blocks for delete
  using (auth.uid() = blocker_id);

-- habits
create policy habits_select on public.habits for select
  using (public.can_view_habit(auth.uid(), id));
create policy habits_insert on public.habits for insert
  with check (auth.uid() = owner_id);
create policy habits_update on public.habits for update
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy habits_delete on public.habits for delete
  using (auth.uid() = owner_id);

-- habit_overrides
create policy habit_overrides_select on public.habit_overrides for select
  using (public.can_view_habit(auth.uid(), habit_id));
create policy habit_overrides_modify on public.habit_overrides for all
  using (exists (
    select 1 from public.habits h
    where h.id = habit_overrides.habit_id and h.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.habits h
    where h.id = habit_overrides.habit_id and h.owner_id = auth.uid()
  ));

-- habit_completions
create policy habit_completions_select on public.habit_completions for select
  using (public.can_view_completion(auth.uid(), id));
create policy habit_completions_insert on public.habit_completions for insert
  with check (auth.uid() = owner_id);
create policy habit_completions_update on public.habit_completions for update
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy habit_completions_delete on public.habit_completions for delete
  using (auth.uid() = owner_id);

-- completion_attachments
create policy completion_attachments_select on public.completion_attachments for select
  using (public.can_view_completion(auth.uid(), completion_id));
create policy completion_attachments_modify on public.completion_attachments for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- completion_likes
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

-- completion_comments
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
create policy completion_comments_delete on public.completion_comments for delete
  using (
    auth.uid() = author_id
    or exists (
      select 1 from public.habit_completions c
      where c.id = completion_id and c.owner_id = auth.uid()
    )
  );

-- comment_likes
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

-- content_reports
create policy content_reports_select on public.content_reports for select
  using (auth.uid() = reporter_id);
create policy content_reports_insert on public.content_reports for insert
  with check (auth.uid() = reporter_id);

-- muted_habits
create policy muted_habits_select on public.muted_habits for select
  using (auth.uid() = user_id);
create policy muted_habits_modify on public.muted_habits for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- expo_push_tokens
create policy expo_push_tokens_select on public.expo_push_tokens for select
  using (auth.uid() = user_id);
create policy expo_push_tokens_modify on public.expo_push_tokens for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- feedback
create policy "Users can insert own feedback"
  on public.feedback for insert
  with check (auth.uid() = user_id);
create policy "Users can read own feedback"
  on public.feedback for select
  using (auth.uid() = user_id);

-- habit_activity
create policy "habit_activity_owner"
  on public.habit_activity for all
  using (owner_id = auth.uid());
create policy "habit_activity_friends_read"
  on public.habit_activity for select
  using (
    owner_id <> auth.uid()
    and public.can_view_activity(auth.uid(), id)
  );

-- activity_likes
create policy activity_likes_select on public.activity_likes for select
  using (
    public.can_view_activity(auth.uid(), activity_id)
    and not public.is_blocked(auth.uid(), user_id)
  );
create policy activity_likes_insert on public.activity_likes for insert
  with check (
    auth.uid() = user_id
    and public.can_view_activity(auth.uid(), activity_id)
  );
create policy activity_likes_delete on public.activity_likes for delete
  using (auth.uid() = user_id);

-- activity_comments
create policy activity_comments_select on public.activity_comments for select
  using (
    public.can_view_activity(auth.uid(), activity_id)
    and not public.is_blocked(auth.uid(), author_id)
  );
create policy activity_comments_insert on public.activity_comments for insert
  with check (
    auth.uid() = author_id
    and public.can_view_activity(auth.uid(), activity_id)
  );
create policy activity_comments_update on public.activity_comments for update
  using (auth.uid() = author_id) with check (auth.uid() = author_id);
create policy activity_comments_delete on public.activity_comments for delete
  using (
    auth.uid() = author_id
    or exists (
      select 1 from public.habit_activity a
      where a.id = activity_id and a.owner_id = auth.uid()
    )
  );

-- activity_comment_likes
create policy activity_comment_likes_select on public.activity_comment_likes for select
  using (
    exists (
      select 1 from public.activity_comments ac
      where ac.id = comment_id
        and public.can_view_activity(auth.uid(), ac.activity_id)
        and not public.is_blocked(auth.uid(), ac.author_id)
    )
    and not public.is_blocked(auth.uid(), user_id)
  );
create policy activity_comment_likes_insert on public.activity_comment_likes for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.activity_comments ac
      where ac.id = comment_id
        and public.can_view_activity(auth.uid(), ac.activity_id)
    )
  );
create policy activity_comment_likes_delete on public.activity_comment_likes for delete
  using (auth.uid() = user_id);


-- ─── friend_feed view ───────────────────────────────────────────────────────

create or replace view public.friend_feed
with (security_invoker = true) as
  select c.id,
         c.habit_id,
         c.owner_id,
         c.occurrence_date,
         c.period_start,
         c.completed_at,
         c.note,
         c.visibility_override,
         c.created_at,
         p.handle         as owner_handle,
         p.avatar_url     as owner_avatar_url
  from public.habit_completions c
  join public.profiles p on p.id = c.owner_id
  where c.owner_id != auth.uid()
    and public.are_friends(auth.uid(), c.owner_id);


-- ─── RPCs ───────────────────────────────────────────────────────────────────

-- Feed page: completions + habit-created activities in one stream
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
  feed_kind            text
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
           'completion'::text as feed_kind
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
           'habit_created'::text as feed_kind
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
         page.feed_kind
  from page
  join public.profiles p on p.id = page.owner_id
  join public.habits   h on h.id = page.habit_id
  order by page.sort_ts desc, page.id desc;
$$;

grant execute on function public.fetch_feed_page(timestamptz, uuid, int) to authenticated;


-- Comments page reader
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


-- Activity comments page reader
create or replace function public.fetch_activity_comments_page(
  target_activity_id  uuid,
  cursor_created_at   timestamptz default null,
  cursor_id           uuid        default null,
  page_limit          int         default 50
)
returns table (
  id                   uuid,
  activity_id          uuid,
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
    select ac.*
    from public.activity_comments ac
    where ac.activity_id = target_activity_id
      and (
        cursor_created_at is null
        or (ac.created_at, ac.id) > (cursor_created_at, cursor_id)
      )
    order by ac.created_at asc, ac.id asc
    limit greatest(page_limit, 1)
  )
  select page.id,
         page.activity_id,
         page.author_id,
         p.handle,
         p.avatar_url,
         page.body,
         page.created_at,
         page.updated_at,
         (select count(*)::int
            from public.activity_comment_likes cl
            where cl.comment_id = page.id) as like_count,
         exists (
           select 1 from public.activity_comment_likes cl
           where cl.comment_id = page.id and cl.user_id = auth.uid()
         ) as viewer_liked
  from page
  join public.profiles p on p.id = page.author_id
  order by page.created_at asc, page.id asc;
$$;

grant execute on function public.fetch_activity_comments_page(uuid, timestamptz, uuid, int) to authenticated;


-- Likers page reader (completions, comments, and activities)
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


-- Accept friend request (atomic: update request + insert friendship)
create or replace function public.accept_friend_request(request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req record;
begin
  select * into req
  from public.friend_requests
  where id = request_id
  for update;

  if req is null then
    raise exception 'friend request not found';
  end if;

  if req.to_user != auth.uid() then
    raise exception 'only the recipient can accept a friend request';
  end if;

  if req.status != 'pending' then
    raise exception 'friend request is not pending (status: %)', req.status;
  end if;

  if public.is_blocked(req.from_user, req.to_user) then
    raise exception 'cannot accept: block relationship exists';
  end if;

  update public.friend_requests
  set status = 'accepted', responded_at = now()
  where id = request_id;

  insert into public.friendships (user_a, user_b)
  values (least(req.from_user, req.to_user), greatest(req.from_user, req.to_user))
  on conflict do nothing;
end;
$$;

grant execute on function public.accept_friend_request(uuid) to authenticated;


-- Search profiles by handle prefix
create or replace function public.search_profiles(
  query       text,
  page_limit  int default 20
)
returns table (
  id                 uuid,
  handle             citext,
  avatar_url         text,
  friendship_status  text
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
      when exists (
        select 1 from public.friendships f
        where f.user_a = least(auth.uid(), p.id)
          and f.user_b = greatest(auth.uid(), p.id)
      ) then 'friend'
      when exists (
        select 1 from public.friend_requests fr
        where fr.status = 'pending'
          and fr.from_user = p.id and fr.to_user = auth.uid()
      ) then 'pending_incoming'
      when exists (
        select 1 from public.friend_requests fr
        where fr.status = 'pending'
          and fr.from_user = auth.uid() and fr.to_user = p.id
      ) then 'pending_outgoing'
      else 'none'
    end as friendship_status
  from public.profiles p
  where p.id != auth.uid()
    and not public.is_blocked(auth.uid(), p.id)
    and p.handle ilike (query || '%')
  order by p.handle asc
  limit greatest(page_limit, 1);
$$;

grant execute on function public.search_profiles(text, int) to authenticated;


-- Paginated friends list
create or replace function public.fetch_friends_page(
  cursor_handle  citext       default null,
  cursor_id      uuid         default null,
  page_limit     int          default 30
)
returns table (
  id            uuid,
  handle        citext,
  avatar_url    text
)
language sql stable
as $$
  with my_friends as (
    select case when f.user_a = auth.uid() then f.user_b else f.user_a end as friend_id
    from public.friendships f
    where f.user_a = auth.uid() or f.user_b = auth.uid()
  )
  select p.id, p.handle, p.avatar_url
  from my_friends mf
  join public.profiles p on p.id = mf.friend_id
  where cursor_handle is null
     or (p.handle, p.id) > (cursor_handle, cursor_id)
  order by p.handle asc, p.id asc
  limit greatest(page_limit, 1);
$$;

grant execute on function public.fetch_friends_page(citext, uuid, int) to authenticated;


-- Paginated friend requests
create or replace function public.fetch_friend_requests_page(
  direction         text,
  cursor_created_at timestamptz default null,
  cursor_id         uuid        default null,
  page_limit        int         default 20
)
returns table (
  id            uuid,
  from_user     uuid,
  to_user       uuid,
  status        friend_request_status,
  created_at    timestamptz,
  responded_at  timestamptz,
  profile_id    uuid,
  handle        citext,
  avatar_url    text
)
language sql stable
as $$
  select
    fr.id,
    fr.from_user,
    fr.to_user,
    fr.status,
    fr.created_at,
    fr.responded_at,
    p.id   as profile_id,
    p.handle,
    p.avatar_url
  from public.friend_requests fr
  join public.profiles p on p.id = case
    when direction = 'incoming' then fr.from_user
    else fr.to_user
  end
  where fr.status = 'pending'
    and (
      (direction = 'incoming' and fr.to_user = auth.uid())
      or
      (direction = 'outgoing' and fr.from_user = auth.uid())
    )
    and (
      cursor_created_at is null
      or (fr.created_at, fr.id) < (cursor_created_at, cursor_id)
    )
  order by fr.created_at desc, fr.id desc
  limit greatest(page_limit, 1);
$$;

grant execute on function public.fetch_friend_requests_page(text, timestamptz, uuid, int) to authenticated;


-- ─── completion-media storage bucket ────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'completion-media',
  'completion-media',
  false,
  52428800,
  array['image/jpeg', 'image/png', 'image/heic', 'image/heif',
        'video/mp4', 'video/quicktime']
)
on conflict (id) do update
  set file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public             = excluded.public;

create policy completion_media_upload
  on storage.objects for insert
  with check (
    bucket_id = 'completion-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy completion_media_read
  on storage.objects for select
  using (
    bucket_id = 'completion-media'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or exists (
        select 1 from public.completion_attachments a
        where a.storage_path = name
          and public.can_view_completion(auth.uid(), a.completion_id)
      )
    )
  );

create policy completion_media_delete
  on storage.objects for delete
  using (
    bucket_id = 'completion-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );


-- ─── Table & column documentation ──────────────────────────────────────────

comment on table public.profiles is
  'User profiles. Auto-created on auth.users insert via handle_new_user trigger.';
comment on table public.habits is
  'Recurring behaviors. scheduled (RRULE-based) or flex (target count per period).';
comment on table public.habit_overrides is
  'Per-occurrence modifications to a scheduled habit (skip/reschedule/edit).';
comment on table public.habit_completions is
  'A user marked a habit done. occurrence_date for scheduled, period_start for flex.';
comment on table public.completion_attachments is
  'Photos and videos attached to a completion. Files live in storage bucket completion-media.';
comment on table public.friendships is
  'Mutual friendships. user_a < user_b enforced for canonicalization.';
comment on table public.friend_requests is
  'Pending and historical friend requests. At most one pending per pair.';
comment on table public.blocks is
  'One-way blocks. Affect feed visibility and request eligibility.';
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
comment on table public.habit_activity is
  'One row per habit lifecycle event (currently only "created"). Feeds the social feed.';
comment on table public.activity_likes is
  'A user''s heart on a habit activity event. Unique per (activity_id, user_id).';
comment on table public.activity_comments is
  'Flat-list comments on a habit activity event. 1-500 chars. No threading.';
comment on table public.activity_comment_likes is
  'A user''s heart on an activity comment. Unique per (comment_id, user_id).';

comment on column public.profiles.week_start is
  'First day of the week for calendar displays. 0=Sun..6=Sat.';
comment on column public.habits.lineage_id is
  'Groups master rows produced by "this and following" edits. Defaults to id.';
comment on column public.habits.sort_index is
  'User-controlled ordering of habits across views. Sorted ASC, tie-broken by created_at.';
comment on column public.habit_completions.visibility_override is
  'Narrows the parent habit''s visibility for this completion only. Validated by trigger.';

comment on function public.can_view_activity(uuid, uuid) is
  'Returns true if viewer can see the given activity row (visibility + friendship + block).';
comment on function public.accept_friend_request(uuid) is
  'Atomically accept a pending friend request and create the friendship row.';
comment on function public.search_profiles(text, int) is
  'Handle-prefix search excluding self and blocked users. Returns friendship status.';
comment on function public.fetch_feed_page(timestamptz, uuid, int) is
  'Single-round-trip feed page. Keyset cursor on (completed_at, id) desc.';
comment on function public.fetch_comments_page(uuid, timestamptz, uuid, int) is
  'Paginated comments for a completion, ascending by created_at.';
comment on function public.fetch_activity_comments_page(uuid, timestamptz, uuid, int) is
  'Paginated comments for an activity event, ascending by created_at.';
comment on function public.fetch_likers_page(like_target_kind, uuid, timestamptz, uuid, int) is
  'Paginated likers for a completion, comment, or activity, descending by liked_at.';
comment on function public.fetch_friends_page(citext, uuid, int) is
  'Paginated friends list ordered by handle. Keyset cursor on (handle, id).';
comment on function public.fetch_friend_requests_page(text, timestamptz, uuid, int) is
  'Paginated pending friend requests (incoming or outgoing), most recent first.';


-- ─── Realtime ───────────────────────────────────────────────────────────────

alter publication supabase_realtime add table public.friend_requests;
alter publication supabase_realtime add table public.friendships;
