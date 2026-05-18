-- Add default_visibility preference to profiles.
-- Controls which visibility is pre-selected when the user creates a new habit.
-- Defaults to 'public' per user feedback (issue #11).

alter table public.profiles
  add column if not exists default_visibility text not null default 'public';

alter table public.profiles
  drop constraint if exists profiles_default_visibility_check;
alter table public.profiles
  add constraint profiles_default_visibility_check
  check (default_visibility in ('public', 'friends', 'private'));

comment on column public.profiles.default_visibility is
  'Preferred visibility pre-selected when creating a new habit.';
