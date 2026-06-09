-- Add missing columns to feedback table

alter table public.feedback
  add column desired_behavior text,
  add column current_behavior text,
  add column screenshot_path  text;

-- ─── feedback-media storage bucket ──────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'feedback-media',
  'feedback-media',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/heic', 'image/heif']
)
on conflict (id) do update
  set file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public             = excluded.public;

create policy feedback_media_upload
  on storage.objects for insert
  with check (
    bucket_id = 'feedback-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy feedback_media_read
  on storage.objects for select
  using (
    bucket_id = 'feedback-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
