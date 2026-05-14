-- Add week-start preference to profiles.
-- 0 = Sunday, 1 = Monday, ..., 6 = Saturday.
-- Used by the Calendar tab's Week view.

alter table public.profiles
  add column if not exists week_start smallint not null default 0;

alter table public.profiles
  drop constraint if exists profiles_week_start_range;
alter table public.profiles
  add constraint profiles_week_start_range
  check (week_start between 0 and 6);

comment on column public.profiles.week_start is
  'First day of the week for calendar displays. 0=Sun..6=Sat.';
