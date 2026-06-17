-- Rest records: a per-habit period that makes the habit's due days streak-
-- neutral while carrying its own note/media and a single feed post. Streak
-- neutralization still rides on per-occurrence habit_overrides (kind 'skip'),
-- now tagged with rest_id so a rest can be cancelled/trimmed atomically.
-- Additive only — no existing migration is modified.

create table public.habit_rests (
  id                   uuid primary key default gen_random_uuid(),
  habit_id             uuid not null references public.habits(id) on delete cascade,
  owner_id             uuid not null references public.profiles(id) on delete cascade,

  start_date           date not null,
  end_date             date not null,
  note                 text check (note is null or char_length(note) <= 2000),
  visibility_override  habit_visibility,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  check (end_date >= start_date)
);

create index habit_rests_habit_idx  on public.habit_rests (habit_id);
create index habit_rests_owner_idx  on public.habit_rests (owner_id);
create index habit_rests_active_idx on public.habit_rests (owner_id, start_date, end_date);

create trigger habit_rests_updated_at
  before update on public.habit_rests
  for each row execute function public.set_updated_at();

-- Link neutral overrides back to the rest that created them. Cancelling a rest
-- (delete) cascades its overrides away; trimming clears today-and-later ones
-- explicitly and keeps the rest row for history/feed.
alter table public.habit_overrides
  add column rest_id uuid references public.habit_rests(id) on delete cascade;

create index habit_overrides_rest_idx on public.habit_overrides (rest_id);

-- ─── RLS ────────────────────────────────────────────────────────────────────
-- Mirrors habit_overrides: friends can view rests on habits they can see; only
-- the owner mutates. Per-rest visibility_override is enforced at the feed RPC
-- layer (a later slice), exactly as completions do.
alter table public.habit_rests enable row level security;

create policy habit_rests_select on public.habit_rests for select
  using (public.can_view_habit(auth.uid(), habit_id));

create policy habit_rests_modify on public.habit_rests for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
