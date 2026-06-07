-- Engagement notifications: in-app list, batching queue, preferences, and triggers.

-- ─── Tables ────────────────────────────────────────────────────────────────────

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  kind        text not null,
  actor_id    uuid not null references public.profiles(id) on delete cascade,
  target_id   uuid not null,
  comment_id  uuid,
  read        boolean not null default false,
  created_at  timestamptz not null default now(),

  constraint notifications_kind_check check (
    kind in (
      'completion_like', 'completion_comment', 'comment_like',
      'activity_like', 'activity_comment', 'activity_comment_like'
    )
  )
);

create index notifications_user_created on public.notifications(user_id, created_at desc);
create index notifications_user_unread on public.notifications(user_id) where not read;

create table public.pending_like_notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  kind        text not null,
  actor_id    uuid not null references public.profiles(id) on delete cascade,
  target_id   uuid not null,
  comment_id  uuid,
  created_at  timestamptz not null default now(),

  constraint pending_like_kind_check check (
    kind in (
      'completion_like', 'comment_like',
      'activity_like', 'activity_comment_like'
    )
  )
);


-- ─── Profile preferences ───────────────────────────────────────────────────────

alter table public.profiles
  add column notify_likes    boolean not null default true,
  add column notify_comments boolean not null default true;


-- ─── RLS ───────────────────────────────────────────────────────────────────────

alter table public.notifications enable row level security;
alter table public.pending_like_notifications enable row level security;

create policy notifications_select on public.notifications for select
  using (auth.uid() = user_id);

create policy notifications_update on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy notifications_delete on public.notifications for delete
  using (auth.uid() = user_id);

-- pending_like_notifications: only accessed by edge functions via service role.
-- No client-facing policies needed.


-- ─── RPCs ──────────────────────────────────────────────────────────────────────

create or replace function public.fetch_notifications_page(
  cursor_created_at  timestamptz default null,
  cursor_id          uuid        default null,
  page_limit         int         default 30
)
returns table (
  id              uuid,
  kind            text,
  actor_id        uuid,
  actor_handle    citext,
  actor_avatar_url text,
  target_id       uuid,
  comment_id      uuid,
  habit_title     text,
  read            boolean,
  created_at      timestamptz
)
language sql stable
as $$
  with page as (
    select n.*
    from public.notifications n
    where n.user_id = auth.uid()
      and (
        cursor_created_at is null
        or (n.created_at, n.id) < (cursor_created_at, cursor_id)
      )
    order by n.created_at desc, n.id desc
    limit greatest(page_limit, 1)
  )
  select
    page.id,
    page.kind,
    page.actor_id,
    p.handle        as actor_handle,
    p.avatar_url    as actor_avatar_url,
    page.target_id,
    page.comment_id,
    coalesce(h_c.title, h_a.title) as habit_title,
    page.read,
    page.created_at
  from page
  join public.profiles p on p.id = page.actor_id
  left join public.habit_completions hc on hc.id = page.target_id
  left join public.habits h_c on h_c.id = hc.habit_id
  left join public.habit_activity ha on ha.id = page.target_id
  left join public.habits h_a on h_a.id = ha.habit_id
  order by page.created_at desc, page.id desc;
$$;

grant execute on function public.fetch_notifications_page(timestamptz, uuid, int) to authenticated;


create or replace function public.unread_notification_count()
returns int
language sql stable
as $$
  select count(*)::int
  from public.notifications
  where user_id = auth.uid() and not read;
$$;

grant execute on function public.unread_notification_count() to authenticated;


create or replace function public.mark_all_notifications_read()
returns void
language sql
as $$
  update public.notifications
  set read = true
  where user_id = auth.uid() and not read;
$$;

grant execute on function public.mark_all_notifications_read() to authenticated;


-- ─── Trigger function ──────────────────────────────────────────────────────────

create or replace function public.create_engagement_notification()
returns trigger
language plpgsql security definer
as $$
declare
  v_kind       text;
  v_actor_id   uuid;
  v_recipient  uuid;
  v_target_id  uuid;
  v_comment_id uuid;
begin
  case TG_TABLE_NAME
    when 'completion_likes' then
      v_kind := 'completion_like';
      v_actor_id := NEW.user_id;
      v_target_id := NEW.completion_id;
      v_comment_id := null;
      select owner_id into v_recipient
        from public.habit_completions where id = NEW.completion_id;

    when 'completion_comments' then
      v_kind := 'completion_comment';
      v_actor_id := NEW.author_id;
      v_target_id := NEW.completion_id;
      v_comment_id := NEW.id;
      select owner_id into v_recipient
        from public.habit_completions where id = NEW.completion_id;

    when 'comment_likes' then
      v_kind := 'comment_like';
      v_actor_id := NEW.user_id;
      v_comment_id := NEW.comment_id;
      select author_id, completion_id into v_recipient, v_target_id
        from public.completion_comments where id = NEW.comment_id;

    when 'activity_likes' then
      v_kind := 'activity_like';
      v_actor_id := NEW.user_id;
      v_target_id := NEW.activity_id;
      v_comment_id := null;
      select owner_id into v_recipient
        from public.habit_activity where id = NEW.activity_id;

    when 'activity_comments' then
      v_kind := 'activity_comment';
      v_actor_id := NEW.author_id;
      v_target_id := NEW.activity_id;
      v_comment_id := NEW.id;
      select owner_id into v_recipient
        from public.habit_activity where id = NEW.activity_id;

    when 'activity_comment_likes' then
      v_kind := 'activity_comment_like';
      v_actor_id := NEW.user_id;
      v_comment_id := NEW.comment_id;
      select author_id, activity_id into v_recipient, v_target_id
        from public.activity_comments where id = NEW.comment_id;

    else
      return NEW;
  end case;

  if v_actor_id = v_recipient or v_recipient is null then
    return NEW;
  end if;

  insert into public.notifications (user_id, kind, actor_id, target_id, comment_id)
  values (v_recipient, v_kind, v_actor_id, v_target_id, v_comment_id);

  return NEW;
end;
$$;


-- ─── Triggers ──────────────────────────────────────────────────────────────────

create trigger notify_on_completion_like
  after insert on public.completion_likes
  for each row execute function public.create_engagement_notification();

create trigger notify_on_completion_comment
  after insert on public.completion_comments
  for each row execute function public.create_engagement_notification();

create trigger notify_on_comment_like
  after insert on public.comment_likes
  for each row execute function public.create_engagement_notification();

create trigger notify_on_activity_like
  after insert on public.activity_likes
  for each row execute function public.create_engagement_notification();

create trigger notify_on_activity_comment
  after insert on public.activity_comments
  for each row execute function public.create_engagement_notification();

create trigger notify_on_activity_comment_like
  after insert on public.activity_comment_likes
  for each row execute function public.create_engagement_notification();
