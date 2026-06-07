-- Time-based habits: adds unit system (count vs time) and stopwatch session tracking.

create type habit_unit as enum ('count', 'time');
create type time_display_unit as enum ('seconds', 'minutes', 'hours');

alter table public.habits
  add column unit habit_unit not null default 'count',
  add column target_seconds int,
  add column display_unit time_display_unit;

-- Re-state the existing kind constraint (required after adding columns that
-- participate in a new constraint — Postgres won't let us reference new columns
-- in the old CHECK without dropping and re-adding).
alter table public.habits drop constraint habits_check;
alter table public.habits add constraint habits_check check (
  (kind = 'scheduled'
     and dtstart is not null and rrule is not null
     and target_count is null and target_period is null)
  or
  (kind = 'flex'
     and target_count is not null and target_count > 0 and target_period is not null
     and dtstart is null and rrule is null and until is null)
);

alter table public.habits add constraint habits_unit_check check (
  (unit = 'count' and target_seconds is null and display_unit is null)
  or
  (unit = 'time' and target_seconds is not null and target_seconds > 0 and display_unit is not null)
);

-- Stopwatch session tracking
create table public.time_entries (
  id               uuid primary key default gen_random_uuid(),
  habit_id         uuid not null references public.habits(id) on delete cascade,
  owner_id         uuid not null references public.profiles(id) on delete cascade,
  occurrence_date  date,
  period_start     date,
  started_at       timestamptz not null,
  ended_at         timestamptz,
  duration_seconds int,
  created_at       timestamptz not null default now(),

  check (
    (occurrence_date is not null and period_start is null)
    or (occurrence_date is null and period_start is not null)
  ),
  check (duration_seconds is null or duration_seconds >= 0)
);

create index time_entries_habit_date_idx
  on public.time_entries (habit_id, occurrence_date);
create index time_entries_habit_period_idx
  on public.time_entries (habit_id, period_start);
create index time_entries_owner_idx
  on public.time_entries (owner_id);

alter table public.time_entries enable row level security;

create policy time_entries_owner on public.time_entries
  for all using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
