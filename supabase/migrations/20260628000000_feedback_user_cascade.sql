-- Fix: deleting an auth user failed with "Database error deleting user".
--
-- Every public table cascades off public.profiles (which cascades off
-- auth.users), so deleting a user tears down all their data — EXCEPT
-- public.feedback, whose user_id referenced auth.users(id) with the default
-- ON DELETE NO ACTION. Any feedback row therefore blocked the user delete.
--
-- This also unblocks in-app account deletion (App Store Guideline 5.1.1(v)),
-- which would hit the same constraint in production. Additive — the original
-- migration is left untouched.

alter table public.feedback
  drop constraint if exists feedback_user_id_fkey;

alter table public.feedback
  add constraint feedback_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;
