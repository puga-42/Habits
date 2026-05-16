-- ============================================================================
-- Friends feature: RPCs for accepting requests, searching profiles, paginated
-- friends list, and paginated friend requests. See FRIENDS_PLAN.md.
-- ============================================================================


-- ─── Partial index for fast pending-incoming count (tab badge) ────────────

create index if not exists friend_requests_pending_to_idx
  on public.friend_requests (to_user)
  where status = 'pending';


-- ─── accept_friend_request ────────────────────────────────────────────────

create or replace function public.accept_friend_request(request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req record;
begin
  select * into req
  from public.friend_requests
  where id = request_id
  for update;

  if req is null then
    raise exception 'friend request not found';
  end if;

  if req.to_user != auth.uid() then
    raise exception 'only the recipient can accept a friend request';
  end if;

  if req.status != 'pending' then
    raise exception 'friend request is not pending (status: %)', req.status;
  end if;

  if public.is_blocked(req.from_user, req.to_user) then
    raise exception 'cannot accept: block relationship exists';
  end if;

  update public.friend_requests
  set status = 'accepted', responded_at = now()
  where id = request_id;

  insert into public.friendships (user_a, user_b)
  values (least(req.from_user, req.to_user), greatest(req.from_user, req.to_user))
  on conflict do nothing;
end;
$$;

grant execute on function public.accept_friend_request(uuid) to authenticated;


-- ─── search_profiles ──────────────────────────────────────────────────────

create or replace function public.search_profiles(
  query       text,
  page_limit  int default 20
)
returns table (
  id                 uuid,
  handle             citext,
  display_name       text,
  avatar_url         text,
  friendship_status  text
)
language sql stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.handle,
    p.display_name,
    p.avatar_url,
    case
      when exists (
        select 1 from public.friendships f
        where f.user_a = least(auth.uid(), p.id)
          and f.user_b = greatest(auth.uid(), p.id)
      ) then 'friend'
      when exists (
        select 1 from public.friend_requests fr
        where fr.status = 'pending'
          and fr.from_user = p.id and fr.to_user = auth.uid()
      ) then 'pending_incoming'
      when exists (
        select 1 from public.friend_requests fr
        where fr.status = 'pending'
          and fr.from_user = auth.uid() and fr.to_user = p.id
      ) then 'pending_outgoing'
      else 'none'
    end as friendship_status
  from public.profiles p
  where p.id != auth.uid()
    and not public.is_blocked(auth.uid(), p.id)
    and p.handle ilike (query || '%')
  order by p.handle asc
  limit greatest(page_limit, 1);
$$;

grant execute on function public.search_profiles(text, int) to authenticated;


-- ─── fetch_friends_page ───────────────────────────────────────────────────

create or replace function public.fetch_friends_page(
  cursor_display_name  text         default null,
  cursor_id            uuid         default null,
  page_limit           int          default 30
)
returns table (
  id            uuid,
  handle        citext,
  display_name  text,
  avatar_url    text
)
language sql stable
as $$
  with my_friends as (
    select case when f.user_a = auth.uid() then f.user_b else f.user_a end as friend_id
    from public.friendships f
    where f.user_a = auth.uid() or f.user_b = auth.uid()
  )
  select p.id, p.handle, p.display_name, p.avatar_url
  from my_friends mf
  join public.profiles p on p.id = mf.friend_id
  where cursor_display_name is null
     or (p.display_name, p.id) > (cursor_display_name, cursor_id)
  order by p.display_name asc, p.id asc
  limit greatest(page_limit, 1);
$$;

grant execute on function public.fetch_friends_page(text, uuid, int) to authenticated;


-- ─── fetch_friend_requests_page ───────────────────────────────────────────

create or replace function public.fetch_friend_requests_page(
  direction         text,
  cursor_created_at timestamptz default null,
  cursor_id         uuid        default null,
  page_limit        int         default 20
)
returns table (
  id            uuid,
  from_user     uuid,
  to_user       uuid,
  status        friend_request_status,
  created_at    timestamptz,
  responded_at  timestamptz,
  profile_id    uuid,
  handle        citext,
  display_name  text,
  avatar_url    text
)
language sql stable
as $$
  select
    fr.id,
    fr.from_user,
    fr.to_user,
    fr.status,
    fr.created_at,
    fr.responded_at,
    p.id   as profile_id,
    p.handle,
    p.display_name,
    p.avatar_url
  from public.friend_requests fr
  join public.profiles p on p.id = case
    when direction = 'incoming' then fr.from_user
    else fr.to_user
  end
  where fr.status = 'pending'
    and (
      (direction = 'incoming' and fr.to_user = auth.uid())
      or
      (direction = 'outgoing' and fr.from_user = auth.uid())
    )
    and (
      cursor_created_at is null
      or (fr.created_at, fr.id) < (cursor_created_at, cursor_id)
    )
  order by fr.created_at desc, fr.id desc
  limit greatest(page_limit, 1);
$$;

grant execute on function public.fetch_friend_requests_page(text, timestamptz, uuid, int) to authenticated;


-- ─── Documentation ────────────────────────────────────────────────────────

comment on function public.accept_friend_request(uuid) is
  'Atomically accept a pending friend request and create the friendship row.';
comment on function public.search_profiles(text, int) is
  'Handle-prefix search excluding self and blocked users. Returns friendship status.';
comment on function public.fetch_friends_page(text, uuid, int) is
  'Paginated friends list ordered by display_name. Keyset cursor on (display_name, id).';
comment on function public.fetch_friend_requests_page(text, timestamptz, uuid, int) is
  'Paginated pending friend requests (incoming or outgoing), most recent first.';
