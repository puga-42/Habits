-- ============================================================================
-- RPCs for the user profile page.
-- See PLAN.md for design and CONTEXT.md for vocabulary.
-- ============================================================================


-- ─── get_user_profile_page ─────────────────────────────────────────────────
-- Returns profile data, friendship status, friends_since date, and mutual
-- friend count. Returns empty if the viewer has blocked / been blocked by
-- the target.

create or replace function public.get_user_profile_page(
  p_target_id  uuid,
  p_viewer_id  uuid
)
returns table (
  id                 uuid,
  handle             citext,
  avatar_url         text,
  friendship_status  text,
  friends_since      timestamptz,
  mutual_friend_count int
)
language sql stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.handle,
    p.avatar_url,
    case
      when p_target_id = p_viewer_id then 'self'
      when exists (
        select 1 from public.friendships f
        where f.user_a = least(p_viewer_id, p.id)
          and f.user_b = greatest(p_viewer_id, p.id)
      ) then 'friend'
      when exists (
        select 1 from public.friend_requests fr
        where fr.status = 'pending'
          and fr.from_user = p_viewer_id and fr.to_user = p.id
      ) then 'pending_outgoing'
      when exists (
        select 1 from public.friend_requests fr
        where fr.status = 'pending'
          and fr.from_user = p.id and fr.to_user = p_viewer_id
      ) then 'pending_incoming'
      else 'none'
    end as friendship_status,
    (
      select f.created_at from public.friendships f
      where f.user_a = least(p_viewer_id, p.id)
        and f.user_b = greatest(p_viewer_id, p.id)
    ) as friends_since,
    (
      select count(*)::int
      from public.friendships f1
      join public.friendships f2
        on (case when f1.user_a = p_viewer_id then f1.user_b else f1.user_a end)
         = (case when f2.user_a = p_target_id then f2.user_b else f2.user_a end)
      where (f1.user_a = p_viewer_id or f1.user_b = p_viewer_id)
        and (f2.user_a = p_target_id or f2.user_b = p_target_id)
    ) as mutual_friend_count
  from public.profiles p
  where p.id = p_target_id
    and not public.is_blocked(p_viewer_id, p_target_id);
$$;

grant execute on function public.get_user_profile_page(uuid, uuid) to authenticated;


-- ─── get_user_visible_habits ───────────────────────────────────────────────
-- Returns habits visible to the viewer: all (non-deleted) for self, public +
-- friends-only for friends, public-only for non-friends. Empty if blocked.

create or replace function public.get_user_visible_habits(
  p_target_id  uuid,
  p_viewer_id  uuid
)
returns table (
  id          uuid,
  lineage_id  uuid,
  title       text,
  icon        text,
  color       text,
  kind        habit_kind
)
language sql stable
security definer
set search_path = public
as $$
  select h.id, h.lineage_id, h.title, h.icon, h.color, h.kind
  from public.habits h
  where h.owner_id = p_target_id
    and h.deleted_at is null
    and not public.is_blocked(p_viewer_id, p_target_id)
    and (
      p_target_id = p_viewer_id
      or h.visibility = 'public'
      or (h.visibility = 'friends'
          and public.are_friends(p_viewer_id, p_target_id))
    )
  order by h.sort_index asc, h.created_at asc;
$$;

grant execute on function public.get_user_visible_habits(uuid, uuid) to authenticated;


-- ─── get_user_feed_page ────────────────────────────────────────────────────
-- Like fetch_feed_page but scoped to a single owner. Optional lineage filter
-- for the habit chip selection. Same visibility/RLS rules.

create or replace function public.get_user_feed_page(
  p_target_id         uuid,
  p_habit_lineage_id  uuid        default null,
  p_cursor_sort_key   timestamptz default null,
  p_cursor_id         uuid        default null,
  p_limit             int         default 20
)
returns table (
  id                   uuid,
  habit_id             uuid,
  owner_id             uuid,
  occurrence_date      date,
  period_start         date,
  completed_at         timestamptz,
  created_at           timestamptz,
  note                 text,
  visibility_override  habit_visibility,
  owner_handle         citext,
  owner_avatar_url     text,
  habit_title          text,
  habit_icon           text,
  habit_color          text,
  habit_kind           habit_kind,
  attachments          jsonb,
  like_count           int,
  comment_count        int,
  viewer_liked         boolean,
  feed_kind            text
)
language sql stable
security definer
set search_path = public
as $$
  with page as (
    -- completions
    select c.id,
           c.habit_id,
           c.owner_id,
           c.occurrence_date,
           c.period_start,
           c.completed_at,
           c.created_at,
           c.note,
           c.visibility_override,
           c.completed_at as sort_ts,
           'completion'::text as feed_kind
    from public.habit_completions c
    join public.habits h on h.id = c.habit_id
    where c.owner_id = p_target_id
      and not public.is_blocked(auth.uid(), p_target_id)
      and (
        p_target_id = auth.uid()
        or (
          coalesce(c.visibility_override, h.visibility) in ('public')
          or (coalesce(c.visibility_override, h.visibility) = 'friends'
              and public.are_friends(auth.uid(), p_target_id))
        )
      )
      and (p_habit_lineage_id is null or h.lineage_id = p_habit_lineage_id)
      and (
        p_cursor_sort_key is null
        or (c.completed_at, c.id) < (p_cursor_sort_key, p_cursor_id)
      )

    union all

    -- habit_created activities
    select a.id,
           a.habit_id,
           a.owner_id,
           null::date,
           null::date,
           null::timestamptz,
           a.created_at,
           null::text,
           null::habit_visibility,
           a.created_at as sort_ts,
           'habit_created'::text as feed_kind
    from public.habit_activity a
    join public.habits h on h.id = a.habit_id
    where a.owner_id = p_target_id
      and a.event_type = 'created'
      and h.deleted_at is null
      and not public.is_blocked(auth.uid(), p_target_id)
      and (
        p_target_id = auth.uid()
        or (h.visibility in ('public')
            or (h.visibility = 'friends'
                and public.are_friends(auth.uid(), p_target_id)))
      )
      and (p_habit_lineage_id is null or h.lineage_id = p_habit_lineage_id)
      and (
        p_cursor_sort_key is null
        or (a.created_at, a.id) < (p_cursor_sort_key, p_cursor_id)
      )

    order by sort_ts desc, id desc
    limit greatest(p_limit, 1)
  )
  select page.id,
         page.habit_id,
         page.owner_id,
         page.occurrence_date,
         page.period_start,
         page.completed_at,
         page.created_at,
         page.note,
         page.visibility_override,
         p.handle,
         p.avatar_url,
         h.title,
         h.icon,
         h.color,
         h.kind,
         case when page.feed_kind = 'completion' then
           coalesce(
             (select jsonb_agg(jsonb_build_object(
                       'id',               att.id,
                       'kind',             att.kind,
                       'storage_path',     att.storage_path,
                       'mime_type',        att.mime_type,
                       'width',            att.width,
                       'height',           att.height,
                       'duration_seconds', att.duration_seconds
                     ) order by att.sort_order)
              from public.completion_attachments att
              where att.completion_id = page.id),
             '[]'::jsonb
           )
         else '[]'::jsonb
         end as attachments,
         case when page.feed_kind = 'completion' then
           (select count(*)::int from public.completion_likes l
            where l.completion_id = page.id)
         else
           (select count(*)::int from public.activity_likes l
            where l.activity_id = page.id)
         end as like_count,
         case when page.feed_kind = 'completion' then
           (select count(*)::int from public.completion_comments cc
            where cc.completion_id = page.id)
         else
           (select count(*)::int from public.activity_comments ac
            where ac.activity_id = page.id)
         end as comment_count,
         case when page.feed_kind = 'completion' then
           exists (select 1 from public.completion_likes l
                   where l.completion_id = page.id and l.user_id = auth.uid())
         else
           exists (select 1 from public.activity_likes l
                   where l.activity_id = page.id and l.user_id = auth.uid())
         end as viewer_liked,
         page.feed_kind
  from page
  join public.profiles p on p.id = page.owner_id
  join public.habits   h on h.id = page.habit_id
  order by page.sort_ts desc, page.id desc;
$$;

grant execute on function public.get_user_feed_page(uuid, uuid, timestamptz, uuid, int) to authenticated;


-- ─── get_mutual_friends ────────────────────────────────────────────────────
-- Returns profiles of users who are friends with both p_user_a and p_user_b.

create or replace function public.get_mutual_friends(
  p_user_a  uuid,
  p_user_b  uuid,
  p_limit   int default 10
)
returns table (
  id          uuid,
  handle      citext,
  avatar_url  text
)
language sql stable
security definer
set search_path = public
as $$
  with friends_of_a as (
    select case when f.user_a = p_user_a then f.user_b else f.user_a end as fid
    from public.friendships f
    where f.user_a = p_user_a or f.user_b = p_user_a
  ),
  friends_of_b as (
    select case when f.user_a = p_user_b then f.user_b else f.user_a end as fid
    from public.friendships f
    where f.user_a = p_user_b or f.user_b = p_user_b
  )
  select p.id, p.handle, p.avatar_url
  from friends_of_a a
  join friends_of_b b on a.fid = b.fid
  join public.profiles p on p.id = a.fid
  where not public.is_blocked(p_user_a, a.fid)
    and not public.is_blocked(p_user_b, a.fid)
  order by p.handle asc
  limit greatest(p_limit, 1);
$$;

grant execute on function public.get_mutual_friends(uuid, uuid, int) to authenticated;
