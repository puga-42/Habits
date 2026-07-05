-- Notification outbox refactor. See OUTBOX_NOTIFICATIONS_PLAN.md.
--
-- Makes `notifications` the single source of truth for BOTH the in-app list and
-- push delivery, replacing three overlapping mechanisms:
--   • create_engagement_notification  (in-app, 6 tables)
--   • create_adoption_notification    (in-app, habit_adopted)
--   • invoke_notify_on_engagement     (pg_net push HTTP, 7 tables)
-- with one enqueue_notification() trigger writing one row per social event —
-- now including the rest_* tables and friend_requests, which previously produced
-- no notification at all. Push is delivered by the notification-dispatcher edge
-- function draining the queue on a pg_cron schedule (defined at the end here),
-- with retry / dead-letter / observability instead of fire-and-forget HTTP.

-- ════════════════════════════════════════════════════════════════════════════
-- 1. Schema — widen kinds, add push-delivery state, health view
-- ════════════════════════════════════════════════════════════════════════════

alter table public.notifications drop constraint notifications_kind_check;

alter table public.notifications add constraint notifications_kind_check check (
  kind in (
    'completion_like', 'completion_comment', 'comment_like',
    'activity_like', 'activity_comment', 'activity_comment_like',
    'habit_adopted',
    'rest_like', 'rest_comment', 'rest_comment_like',
    'friend_request', 'friend_request_accepted'
  )
);

-- Push-delivery state (drives the dispatcher; in-app columns untouched):
--   pending  — awaiting push
--   sending  — claimed by a dispatcher run (reclaimed if it stalls)
--   sent     — delivered to Expo
--   skipped  — recipient pref off / blocked / no token: never push, in-app only
--   failed   — exhausted retries (dead-letter, queryable)
alter table public.notifications
  add column push_state     text        not null default 'pending'
    check (push_state in ('pending', 'sending', 'sent', 'skipped', 'failed')),
  add column push_attempts  int         not null default 0,
  add column push_not_before timestamptz not null default now(),
  add column push_claimed_at timestamptz,
  add column push_batch_key   text;

-- Dispatcher scan: due, undelivered rows, oldest first.
create index notifications_push_due
  on public.notifications (push_not_before)
  where push_state = 'pending';

-- Health / observability — silent breakage was the root cause of the old system.
-- Owner-only (not granted to authenticated); inspect via SQL editor / service role.
create or replace function public.notification_push_health()
returns table (
  pending      bigint,
  sending      bigint,
  failed       bigint,
  stuck        bigint,   -- pending and overdue by >10 min
  oldest_pending_age interval
)
language sql stable
security definer
set search_path = public
as $$
  select
    count(*) filter (where push_state = 'pending'),
    count(*) filter (where push_state = 'sending'),
    count(*) filter (where push_state = 'failed'),
    count(*) filter (where push_state = 'pending' and push_not_before < now() - interval '10 minutes'),
    now() - min(created_at) filter (where push_state = 'pending')
  from public.notifications;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. Enqueue trigger + cutover
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.enqueue_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind       text;
  v_actor      uuid;
  v_recipient  uuid;
  v_target     uuid;
  v_comment    uuid := null;
  v_is_like    boolean := false;
  v_batch_key  text := null;
  v_not_before timestamptz := now();
  batch_delay  constant interval := interval '10 minutes';
begin
  case TG_TABLE_NAME
    when 'completion_likes' then
      v_kind := 'completion_like'; v_is_like := true;
      v_actor := NEW.user_id; v_target := NEW.completion_id;
      select owner_id into v_recipient from public.habit_completions where id = NEW.completion_id;

    when 'completion_comments' then
      v_kind := 'completion_comment';
      v_actor := NEW.author_id; v_target := NEW.completion_id; v_comment := NEW.id;
      select owner_id into v_recipient from public.habit_completions where id = NEW.completion_id;

    when 'comment_likes' then
      v_kind := 'comment_like'; v_is_like := true;
      v_actor := NEW.user_id; v_comment := NEW.comment_id;
      select author_id, completion_id into v_recipient, v_target
        from public.completion_comments where id = NEW.comment_id;

    when 'activity_likes' then
      v_kind := 'activity_like'; v_is_like := true;
      v_actor := NEW.user_id; v_target := NEW.activity_id;
      select owner_id into v_recipient from public.habit_activity where id = NEW.activity_id;

    when 'activity_comments' then
      v_kind := 'activity_comment';
      v_actor := NEW.author_id; v_target := NEW.activity_id; v_comment := NEW.id;
      select owner_id into v_recipient from public.habit_activity where id = NEW.activity_id;

    when 'activity_comment_likes' then
      v_kind := 'activity_comment_like'; v_is_like := true;
      v_actor := NEW.user_id; v_comment := NEW.comment_id;
      select author_id, activity_id into v_recipient, v_target
        from public.activity_comments where id = NEW.comment_id;

    when 'rest_likes' then
      v_kind := 'rest_like'; v_is_like := true;
      v_actor := NEW.user_id; v_target := NEW.rest_id;
      select owner_id into v_recipient from public.habit_rests where id = NEW.rest_id;

    when 'rest_comments' then
      v_kind := 'rest_comment';
      v_actor := NEW.author_id; v_target := NEW.rest_id; v_comment := NEW.id;
      select owner_id into v_recipient from public.habit_rests where id = NEW.rest_id;

    when 'rest_comment_likes' then
      v_kind := 'rest_comment_like'; v_is_like := true;
      v_actor := NEW.user_id; v_comment := NEW.comment_id;
      select author_id, rest_id into v_recipient, v_target
        from public.rest_comments where id = NEW.comment_id;

    when 'habit_activity' then
      -- Only adoption events notify; 'created' events do not.
      if NEW.event_type <> 'adopted' or NEW.adopted_from_user_id is null then
        return NEW;
      end if;
      v_kind := 'habit_adopted';
      v_actor := NEW.owner_id; v_recipient := NEW.adopted_from_user_id; v_target := NEW.id;

    when 'friend_requests' then
      if TG_OP = 'INSERT' then
        if NEW.status <> 'pending' then return NEW; end if;
        v_kind := 'friend_request';
        v_actor := NEW.from_user; v_recipient := NEW.to_user; v_target := NEW.id;
      else -- UPDATE: only the pending → accepted transition
        if not (OLD.status = 'pending' and NEW.status = 'accepted') then return NEW; end if;
        v_kind := 'friend_request_accepted';
        v_actor := NEW.to_user; v_recipient := NEW.from_user; v_target := NEW.id;
      end if;

    else
      return NEW;
  end case;

  -- Self-action or unresolved recipient → nothing to notify.
  if v_recipient is null or v_recipient = v_actor then
    return NEW;
  end if;

  -- Blocked in either direction → no notification at all (in-app or push).
  if public.is_blocked(v_actor, v_recipient) then
    return NEW;
  end if;

  -- Likes collapse: delay so same-target likes accumulate into one push.
  if v_is_like then
    v_batch_key := v_kind || ':' || v_target::text;
    v_not_before := now() + batch_delay;
  end if;

  insert into public.notifications
    (user_id, kind, actor_id, target_id, comment_id, push_batch_key, push_not_before)
  values
    (v_recipient, v_kind, v_actor, v_target, v_comment, v_batch_key, v_not_before);

  return NEW;
end;
$$;

-- Drop the three superseded mechanisms.
drop trigger if exists notify_on_completion_like     on public.completion_likes;
drop trigger if exists notify_on_completion_comment  on public.completion_comments;
drop trigger if exists notify_on_comment_like        on public.comment_likes;
drop trigger if exists notify_on_activity_like       on public.activity_likes;
drop trigger if exists notify_on_activity_comment    on public.activity_comments;
drop trigger if exists notify_on_activity_comment_like on public.activity_comment_likes;
drop function if exists public.create_engagement_notification();

drop trigger if exists trg_adoption_notification on public.habit_activity;
drop function if exists public.create_adoption_notification();

drop trigger if exists webhook_completion_likes        on public.completion_likes;
drop trigger if exists webhook_completion_comments     on public.completion_comments;
drop trigger if exists webhook_comment_likes           on public.comment_likes;
drop trigger if exists webhook_activity_likes          on public.activity_likes;
drop trigger if exists webhook_activity_comments       on public.activity_comments;
drop trigger if exists webhook_activity_comment_likes  on public.activity_comment_likes;
drop trigger if exists webhook_habit_activity          on public.habit_activity;
drop function if exists public.invoke_notify_on_engagement();

-- Wire enqueue on every social surface.
create trigger enqueue_completion_like        after insert on public.completion_likes
  for each row execute function public.enqueue_notification();
create trigger enqueue_completion_comment     after insert on public.completion_comments
  for each row execute function public.enqueue_notification();
create trigger enqueue_comment_like           after insert on public.comment_likes
  for each row execute function public.enqueue_notification();
create trigger enqueue_activity_like          after insert on public.activity_likes
  for each row execute function public.enqueue_notification();
create trigger enqueue_activity_comment       after insert on public.activity_comments
  for each row execute function public.enqueue_notification();
create trigger enqueue_activity_comment_like  after insert on public.activity_comment_likes
  for each row execute function public.enqueue_notification();

-- Previously unnotified: rests.
create trigger enqueue_rest_like              after insert on public.rest_likes
  for each row execute function public.enqueue_notification();
create trigger enqueue_rest_comment           after insert on public.rest_comments
  for each row execute function public.enqueue_notification();
create trigger enqueue_rest_comment_like      after insert on public.rest_comment_likes
  for each row execute function public.enqueue_notification();

-- Adoption (in-app + push in one path now).
create trigger enqueue_habit_adopted          after insert on public.habit_activity
  for each row when (new.event_type = 'adopted')
  execute function public.enqueue_notification();

-- Friend requests: send + accept.
create trigger enqueue_friend_request         after insert on public.friend_requests
  for each row execute function public.enqueue_notification();
create trigger enqueue_friend_request_accept  after update on public.friend_requests
  for each row execute function public.enqueue_notification();

-- Extend fetch_notifications_page for rest + friend targets. Adds a
-- habit_rests → habits join so rest_* notifications resolve a habit title;
-- friend_request(_accepted) rows have no habit (habit_title stays null).
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
    coalesce(h_c.title, h_a.title, h_r.title) as habit_title,
    page.read,
    page.created_at
  from page
  join public.profiles p on p.id = page.actor_id
  left join public.habit_completions hc on hc.id = page.target_id
  left join public.habits h_c on h_c.id = hc.habit_id
  left join public.habit_activity ha on ha.id = page.target_id
  left join public.habits h_a on h_a.id = ha.habit_id
  left join public.habit_rests hr on hr.id = page.target_id
  left join public.habits h_r on h_r.id = hr.habit_id
  order by page.created_at desc, page.id desc;
$$;

grant execute on function public.fetch_notifications_page(timestamptz, uuid, int) to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. Dispatcher RPCs (service-role only — they operate across ALL users' rows)
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.claim_due_notifications(max_rows int default 200)
returns table (
  id           uuid,
  recipient_id uuid,
  kind         text,
  actor_handle citext,
  target_id    uuid,
  comment_id   uuid,
  comment_body text,
  batch_key    text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 1. Retire rows that must never push (pref off / now blocked). In-app row stays.
  update public.notifications n
     set push_state = 'skipped'
   where n.push_state = 'pending'
     and n.push_not_before <= now()
     and (
       public.is_blocked(n.actor_id, n.user_id)
       or (n.kind in ('completion_like','comment_like','activity_like',
                      'activity_comment_like','rest_like','rest_comment_like')
           and not exists (select 1 from public.profiles p
                            where p.id = n.user_id and p.notify_likes))
       or (n.kind in ('completion_comment','activity_comment','rest_comment')
           and not exists (select 1 from public.profiles p
                            where p.id = n.user_id and p.notify_comments))
     );

  -- 2. Reclaim rows a crashed dispatcher left 'sending'.
  update public.notifications n
     set push_state = 'pending'
   where n.push_state = 'sending'
     and n.push_claimed_at < now() - interval '5 minutes';

  -- 3. Claim a batch of due rows and return enriched data for composing pushes.
  return query
  with claimed as (
    update public.notifications n
       set push_state = 'sending',
           push_attempts = n.push_attempts + 1,
           push_claimed_at = now()
     where n.id in (
       select c.id from public.notifications c
        where c.push_state = 'pending'
          and c.push_not_before <= now()
          and c.push_attempts < 5
        order by c.push_not_before
        limit greatest(max_rows, 1)
        for update skip locked
     )
     returning n.id, n.user_id, n.kind, n.actor_id, n.target_id,
               n.comment_id, n.push_batch_key
  )
  select
    c.id, c.user_id, c.kind, p.handle, c.target_id, c.comment_id,
    coalesce(cc.body, ac.body, rc.body) as comment_body,
    c.push_batch_key
  from claimed c
  join public.profiles p on p.id = c.actor_id
  left join public.completion_comments cc on cc.id = c.comment_id
  left join public.activity_comments   ac on ac.id = c.comment_id
  left join public.rest_comments       rc on rc.id = c.comment_id;
end;
$$;

-- p_sent: delivered. p_skipped: terminal non-delivery (recipient has no push
-- token) — done, don't retry. p_failed: transient error — retry until attempts
-- exhaust, then dead-letter to 'failed'.
create or replace function public.mark_notifications_pushed(
  p_sent    uuid[],
  p_failed  uuid[],
  p_skipped uuid[]
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.notifications
     set push_state = 'sent', push_claimed_at = null
   where id = any(p_sent);

  update public.notifications
     set push_state = 'skipped', push_claimed_at = null
   where id = any(p_skipped);

  update public.notifications
     set push_state = case when push_attempts >= 5 then 'failed' else 'pending' end,
         push_claimed_at = null
   where id = any(p_failed);
$$;

revoke execute on function public.claim_due_notifications(int) from public, anon, authenticated;
revoke execute on function public.mark_notifications_pushed(uuid[], uuid[], uuid[])
  from public, anon, authenticated;
grant  execute on function public.claim_due_notifications(int) to service_role;
grant  execute on function public.mark_notifications_pushed(uuid[], uuid[], uuid[])
  to service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. Schedule the dispatcher (pg_cron, every minute)
-- ════════════════════════════════════════════════════════════════════════════
-- Requires pg_cron enabled (Dashboard → Database → Extensions if `create
-- extension` errors) and the Vault secrets supabase_url / service_role_key /
-- webhook_secret. Fallback for plans without pg_cron: an external scheduler
-- POSTing the function URL with the x-webhook-secret header (plan §7).

create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'notification-dispatch') then
    perform cron.unschedule('notification-dispatch');
  end if;
end $$;

select cron.schedule(
  'notification-dispatch',
  '* * * * *',  -- every minute; ≤60s latency for comments/requests
  $CRON$
    select extensions.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_url')
             || '/functions/v1/notification-dispatcher',
      body := '{}'::jsonb,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' ||
          (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
        'x-webhook-secret',
          (select decrypted_secret from vault.decrypted_secrets where name = 'webhook_secret')
      )
    );
  $CRON$
);

-- NOTE: pending_like_notifications is now unused (its role moved to
-- notifications.push_batch_key/push_not_before) and can be dropped in a later
-- cleanup migration, along with the superseded edge functions.
