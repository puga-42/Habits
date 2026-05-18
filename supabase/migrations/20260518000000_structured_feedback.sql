-- Relax body constraint so new structured submissions can omit it.
-- Existing rows keep their data.
alter table public.feedback
  alter column body drop not null;

alter table public.feedback
  drop constraint feedback_body_check;

alter table public.feedback
  add constraint feedback_body_check
  check (body is null or char_length(body) between 1 and 2000);

-- Structured fields
alter table public.feedback
  add column desired_behavior text
    check (desired_behavior is null or char_length(desired_behavior) between 1 and 2000),
  add column current_behavior text
    check (current_behavior is null or char_length(current_behavior) between 1 and 2000),
  add column screenshot_path text;

-- Storage bucket for feedback screenshots
insert into storage.buckets (id, name, public)
values ('feedback-media', 'feedback-media', false)
on conflict (id) do nothing;

-- RLS: authenticated users can upload to their own folder
create policy "Users can upload feedback screenshots"
  on storage.objects for insert
  with check (
    bucket_id = 'feedback-media'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- RLS: users can read their own feedback screenshots
create policy "Users can read own feedback screenshots"
  on storage.objects for select
  using (
    bucket_id = 'feedback-media'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
