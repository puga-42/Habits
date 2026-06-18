-- Rest social layer: likes + comments on rest feed posts, mirroring the
-- activity_* stack, plus a can_view_rest visibility helper that mirrors
-- can_view_completion (effective visibility = coalesce(rest override, habit)).
-- The feed RPC is security-invoker, so per-rest visibility is enforced here via
-- RLS. Additive only — no existing migration file is edited.

-- ─── visibility helper ──────────────────────────────────────────────────────

create or replace function public.can_view_rest(viewer uuid, rest_id_param uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when r.owner_id = viewer then true
    when public.is_blocked(viewer, r.owner_id) then false
    when coalesce(r.visibility_override, h.visibility) = 'public' then true
    when coalesce(r.visibility_override, h.visibility) = 'friends'
      then public.are_friends(viewer, r.owner_id)
    else false
  end
  from public.habit_rests r
  join public.habits h on h.id = r.habit_id
  where r.id = rest_id_param;
$$;

-- Tighten the rest + rest_attachments read policies from habit-level visibility
-- (Slice 1/2) to per-rest visibility, now that the helper exists.
drop policy if exists habit_rests_select on public.habit_rests;
create policy habit_rests_select on public.habit_rests for select
  using (public.can_view_rest(auth.uid(), id));

drop policy if exists rest_attachments_select on public.rest_attachments;
create policy rest_attachments_select on public.rest_attachments for select
  using (public.can_view_rest(auth.uid(), rest_id));

drop policy if exists rest_media_read on storage.objects;
create policy rest_media_read on storage.objects for select
  using (
    bucket_id = 'completion-media'
    and exists (
      select 1 from public.rest_attachments a
      where a.storage_path = name
        and public.can_view_rest(auth.uid(), a.rest_id)
    )
  );

-- ─── likes ──────────────────────────────────────────────────────────────────

create table public.rest_likes (
  rest_id     uuid not null references public.habit_rests(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (rest_id, user_id)
);

create index rest_likes_rest_idx on public.rest_likes (rest_id);
create index rest_likes_user_idx on public.rest_likes (user_id);

-- ─── comments ───────────────────────────────────────────────────────────────

create table public.rest_comments (
  id          uuid primary key default gen_random_uuid(),
  rest_id     uuid not null references public.habit_rests(id) on delete cascade,
  author_id   uuid not null references public.profiles(id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 500),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index rest_comments_rest_idx   on public.rest_comments (rest_id, created_at);
create index rest_comments_author_idx on public.rest_comments (author_id);

create table public.rest_comment_likes (
  comment_id  uuid not null references public.rest_comments(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create index rest_comment_likes_comment_idx on public.rest_comment_likes (comment_id);
create index rest_comment_likes_user_idx    on public.rest_comment_likes (user_id);

-- ─── RLS (mirrors activity_likes / activity_comments / activity_comment_likes)─

alter table public.rest_likes         enable row level security;
alter table public.rest_comments      enable row level security;
alter table public.rest_comment_likes enable row level security;

-- rest_likes
create policy rest_likes_select on public.rest_likes for select
  using (
    public.can_view_rest(auth.uid(), rest_id)
    and not public.is_blocked(auth.uid(), user_id)
  );
create policy rest_likes_insert on public.rest_likes for insert
  with check (
    auth.uid() = user_id
    and public.can_view_rest(auth.uid(), rest_id)
  );
create policy rest_likes_delete on public.rest_likes for delete
  using (auth.uid() = user_id);

-- rest_comments
create policy rest_comments_select on public.rest_comments for select
  using (
    public.can_view_rest(auth.uid(), rest_id)
    and not public.is_blocked(auth.uid(), author_id)
  );
create policy rest_comments_insert on public.rest_comments for insert
  with check (
    auth.uid() = author_id
    and public.can_view_rest(auth.uid(), rest_id)
  );
create policy rest_comments_update on public.rest_comments for update
  using (auth.uid() = author_id) with check (auth.uid() = author_id);
create policy rest_comments_delete on public.rest_comments for delete
  using (
    auth.uid() = author_id
    or exists (
      select 1 from public.habit_rests r
      where r.id = rest_id and r.owner_id = auth.uid()
    )
  );

-- rest_comment_likes
create policy rest_comment_likes_select on public.rest_comment_likes for select
  using (
    exists (
      select 1 from public.rest_comments rc
      where rc.id = comment_id
        and public.can_view_rest(auth.uid(), rc.rest_id)
        and not public.is_blocked(auth.uid(), rc.author_id)
    )
    and not public.is_blocked(auth.uid(), user_id)
  );
create policy rest_comment_likes_insert on public.rest_comment_likes for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.rest_comments rc
      where rc.id = comment_id
        and public.can_view_rest(auth.uid(), rc.rest_id)
    )
  );
create policy rest_comment_likes_delete on public.rest_comment_likes for delete
  using (auth.uid() = user_id);
