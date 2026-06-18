-- Media for a rest's feed post / day-view note. Mirrors completion_attachments
-- and reuses the same `completion-media` storage bucket (path {owner}/{rest_id}/
-- {uuid}.{ext}). Additive only.

create table public.rest_attachments (
  id                uuid primary key default gen_random_uuid(),
  rest_id           uuid not null references public.habit_rests(id) on delete cascade,
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

  constraint rest_attachments_video_constraints check (
    (kind = 'photo' and duration_seconds is null)
    or
    (kind = 'video' and duration_seconds is not null
       and duration_seconds <= 30
       and byte_size <= 52428800)
  )
);

create index rest_attachments_rest_idx on public.rest_attachments (rest_id);

-- ─── RLS ────────────────────────────────────────────────────────────────────
-- Mirrors completion_attachments: friends can view media on rests they can see
-- (via the rest's habit visibility); only the owner mutates.
alter table public.rest_attachments enable row level security;

create policy rest_attachments_select on public.rest_attachments for select
  using (exists (
    select 1 from public.habit_rests r
    where r.id = rest_attachments.rest_id
      and public.can_view_habit(auth.uid(), r.habit_id)
  ));

create policy rest_attachments_modify on public.rest_attachments for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- ─── Storage read for rest media ────────────────────────────────────────────
-- The bucket's existing upload/delete/owner-read policies already cover rest
-- objects (they key on the owner being the first path segment). This adds the
-- friend-read branch: someone who can view the rest can read its media. SELECT
-- policies are OR'd, so this only widens read access for non-owners.
create policy rest_media_read
  on storage.objects for select
  using (
    bucket_id = 'completion-media'
    and exists (
      select 1 from public.rest_attachments a
      join public.habit_rests r on r.id = a.rest_id
      where a.storage_path = name
        and public.can_view_habit(auth.uid(), r.habit_id)
    )
  );
