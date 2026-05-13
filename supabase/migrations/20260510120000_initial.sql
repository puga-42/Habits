-- ============================================================================
-- Initial schema for the Habits app.
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


-- ─── profiles ──────────────────────────────────────────────────────────────

create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  handle        citext unique not null,
  display_name  text not null,
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint profiles_handle_format check (handle ~ '^[a-zA-Z0-9_]{3,30}$')
);


-- ─── Social graph: friendships, friend_requests, blocks ────────────────────

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

-- At most one pending request between two users, regardless of direction.
create unique index friend_requests_unique_pending
  on public.friend_requests (least(from_user, to_user), greatest(from_user, to_user))
  where status = 'pending';

create index friend_requests_to_user_idx on public.friend_requests (to_user);

create table public.blocks (
  blocker_id  uuid not null references public.profiles(id) on delete cascade,
  blocked_id  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id != blocked_id)
);

create index blocks_blocked_id_idx on public.blocks (blocked_id);


-- ─── habits + habit_overrides ──────────────────────────────────────────────

create table public.habits (
  id           uuid primary key default gen_random_uuid(),
  lineage_id   uuid not null,                       -- defaults to id via trigger
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


-- ─── completions + attachments ─────────────────────────────────────────────

create table public.habit_completions (
  id                   uuid primary key default gen_random_uuid(),
  habit_id             uuid not null references public.habits(id) on delete cascade,
  owner_id             uuid not null references public.profiles(id) on delete cascade,

  occurrence_date      date,            -- scheduled habits
  period_start         date,            -- flex habits
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
  created_at        timestamptz not null default now(),

  constraint attachments_video_constraints check (
    (kind = 'photo' and duration_seconds is null)
    or
    (kind = 'video' and duration_seconds is not null
       and duration_seconds <= 30
       and byte_size <= 52428800)             -- 50 MB
  )
);

create index completion_attachments_completion_idx on public.completion_attachments (completion_id);

-- TODO: trigger or Edge Function to delete the underlying Storage object when a
-- completion_attachments row is removed. For now, client code must delete the
-- Storage object before deleting the row to avoid orphaned files.


-- ─── Triggers: updated_at, lineage default, visibility narrow ──────────────

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

-- visibility_override may only narrow the parent habit's visibility.
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


-- ─── Auto-create profile on signup ─────────────────────────────────────────

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

  insert into public.profiles (id, handle, display_name)
  values (
    new.id,
    candidate,
    coalesce(
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'name', ''),
      candidate
    )
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ─── Helper functions used by RLS ──────────────────────────────────────────
-- SECURITY DEFINER so they can read the social graph without recursing through
-- RLS on the same tables. Pinned search_path avoids privilege escalation.

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


-- ─── Enable RLS on every table ─────────────────────────────────────────────

alter table public.profiles               enable row level security;
alter table public.friendships            enable row level security;
alter table public.friend_requests        enable row level security;
alter table public.blocks                 enable row level security;
alter table public.habits                 enable row level security;
alter table public.habit_overrides        enable row level security;
alter table public.habit_completions      enable row level security;
alter table public.completion_attachments enable row level security;


-- ─── RLS policies ──────────────────────────────────────────────────────────

-- profiles: visible to anyone not in a block relationship; only owner writes.
create policy profiles_select on public.profiles for select
  using (auth.uid() = id or not public.is_blocked(auth.uid(), id));
create policy profiles_insert on public.profiles for insert
  with check (auth.uid() = id);
create policy profiles_update on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);
create policy profiles_delete on public.profiles for delete
  using (auth.uid() = id);

-- friendships: visible to either party; either party can insert (via accepted
-- request flow) or delete (unfriend).
create policy friendships_select on public.friendships for select
  using (auth.uid() in (user_a, user_b));
create policy friendships_insert on public.friendships for insert
  with check (auth.uid() in (user_a, user_b));
create policy friendships_delete on public.friendships for delete
  using (auth.uid() in (user_a, user_b));

-- friend_requests: visible to from/to; only from_user creates; either updates.
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

-- blocks: only the blocker sees, creates, and removes their own blocks.
create policy blocks_select on public.blocks for select
  using (auth.uid() = blocker_id);
create policy blocks_insert on public.blocks for insert
  with check (auth.uid() = blocker_id);
create policy blocks_delete on public.blocks for delete
  using (auth.uid() = blocker_id);

-- habits: read via can_view_habit; only owner writes.
create policy habits_select on public.habits for select
  using (public.can_view_habit(auth.uid(), id));
create policy habits_insert on public.habits for insert
  with check (auth.uid() = owner_id);
create policy habits_update on public.habits for update
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy habits_delete on public.habits for delete
  using (auth.uid() = owner_id);

-- habit_overrides: read mirrors the parent habit's visibility; owner writes.
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

-- habit_completions: effective visibility (override else habit); only owner writes.
create policy habit_completions_select on public.habit_completions for select
  using (public.can_view_completion(auth.uid(), id));
create policy habit_completions_insert on public.habit_completions for insert
  with check (auth.uid() = owner_id);
create policy habit_completions_update on public.habit_completions for update
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy habit_completions_delete on public.habit_completions for delete
  using (auth.uid() = owner_id);

-- completion_attachments: visibility piggybacks on the parent completion.
create policy completion_attachments_select on public.completion_attachments for select
  using (public.can_view_completion(auth.uid(), completion_id));
create policy completion_attachments_modify on public.completion_attachments for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);


-- ─── friend_feed view ──────────────────────────────────────────────────────

-- Stream of friends' visible completions, ordered most-recent first.
-- security_invoker=true makes the view respect the caller's RLS, so the
-- visibility filtering on habit_completions still applies.
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
         p.display_name   as owner_display_name,
         p.avatar_url     as owner_avatar_url
  from public.habit_completions c
  join public.profiles p on p.id = c.owner_id
  where c.owner_id != auth.uid()
    and public.are_friends(auth.uid(), c.owner_id);


-- ─── completion-media storage bucket ───────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'completion-media',
  'completion-media',
  false,
  52428800,  -- 50 MB
  array['image/jpeg', 'image/png', 'image/heic', 'image/heif',
        'video/mp4', 'video/quicktime']
)
on conflict (id) do update
  set file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public             = excluded.public;

-- Object paths are {owner_id}/{completion_id}/{uuid}.{ext}. The first path
-- segment is the owner — we authorize reads/writes against that.

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

comment on column public.habits.lineage_id is
  'Groups master rows produced by "this and following" edits. Defaults to id.';
comment on column public.habit_completions.visibility_override is
  'Narrows the parent habit''s visibility for this completion only. Validated by trigger.';
