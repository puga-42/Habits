-- Track habit creation events for the social feed (issue #10).
-- A row is inserted when a user creates a new habit; friends see a card in
-- their feed according to the habit's visibility.

create table if not exists public.habit_activity (
  id          uuid        primary key default gen_random_uuid(),
  habit_id    uuid        not null references public.habits(id) on delete cascade,
  owner_id    uuid        not null references public.profiles(id) on delete cascade,
  event_type  text        not null default 'created',
  created_at  timestamptz not null default now(),

  constraint habit_activity_event_type_check
    check (event_type in ('created'))
);

create index if not exists habit_activity_created_at_idx
  on public.habit_activity (created_at desc);

alter table public.habit_activity enable row level security;

-- Owner can read and write their own activity rows.
create policy "habit_activity_owner"
  on public.habit_activity
  for all
  using (owner_id = auth.uid());

-- Friends/public can read, following habit visibility + block rules.
create policy "habit_activity_friends_read"
  on public.habit_activity
  for select
  using (
    owner_id <> auth.uid()
    and exists (
      select 1 from public.habits h
      where h.id = habit_activity.habit_id
        and h.deleted_at is null
        and h.visibility in ('public', 'friends')
        and (
          h.visibility = 'public'
          or exists (
            select 1 from public.friendships f
            where (f.user_a = auth.uid() and f.user_b = habit_activity.owner_id)
               or (f.user_b = auth.uid() and f.user_a = habit_activity.owner_id)
          )
        )
    )
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = habit_activity.owner_id)
         or (b.blocker_id = habit_activity.owner_id and b.blocked_id = auth.uid())
    )
  );

comment on table public.habit_activity is
  'One row per habit lifecycle event (currently only "created"). Feeds the social feed.';
