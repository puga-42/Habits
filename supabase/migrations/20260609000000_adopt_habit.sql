-- Adopt Habit: provenance tracking, feed event, and notification support.


-- ─── Schema changes ──────────────────────────────────────────────────────────

alter table public.habits
  add column adopted_from_user_id uuid references public.profiles(id) on delete set null;

alter table public.habit_activity
  add column adopted_from_user_id uuid references public.profiles(id) on delete set null;

alter table public.habit_activity
  drop constraint habit_activity_event_type_check;

alter table public.habit_activity
  add constraint habit_activity_event_type_check
    check (event_type in ('created', 'adopted'));

alter table public.notifications
  drop constraint notifications_kind_check;

alter table public.notifications
  add constraint notifications_kind_check check (
    kind in (
      'completion_like', 'completion_comment', 'comment_like',
      'activity_like', 'activity_comment', 'activity_comment_like',
      'habit_adopted'
    )
  );


-- ─── Update habit-created trigger to handle adoption ─────────────────────────

create or replace function public.insert_habit_created_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.adopted_from_user_id is not null then
    insert into public.habit_activity (habit_id, owner_id, event_type, adopted_from_user_id)
    values (new.id, new.owner_id, 'adopted', new.adopted_from_user_id);
  else
    insert into public.habit_activity (habit_id, owner_id, event_type)
    values (new.id, new.owner_id, 'created');
  end if;
  return new;
end;
$$;


-- ─── Adoption notification trigger ───────────────────────────────────────────

create or replace function public.create_adoption_notification()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.adopted_from_user_id is null then
    return new;
  end if;
  if new.owner_id = new.adopted_from_user_id then
    return new;
  end if;

  insert into public.notifications (user_id, kind, actor_id, target_id)
  values (new.adopted_from_user_id, 'habit_adopted', new.owner_id, new.id);

  return new;
end;
$$;

create trigger trg_adoption_notification
  after insert on public.habit_activity
  for each row
  when (new.event_type = 'adopted')
  execute function public.create_adoption_notification();


-- ─── Update fetch_feed_page to include adopted events and metadata ───────────

drop function if exists public.fetch_feed_page(timestamptz, uuid, int);

create or replace function public.fetch_feed_page(
  cursor_completed_at timestamptz default null,
  cursor_id           uuid        default null,
  page_limit          int         default 20
)
returns table (
  id                    uuid,
  habit_id              uuid,
  owner_id              uuid,
  occurrence_date       date,
  period_start          date,
  completed_at          timestamptz,
  created_at            timestamptz,
  note                  text,
  visibility_override   habit_visibility,
  owner_handle          citext,
  owner_avatar_url      text,
  habit_title           text,
  habit_icon            text,
  habit_color           text,
  habit_kind            habit_kind,
  attachments           jsonb,
  like_count            int,
  comment_count         int,
  viewer_liked          boolean,
  feed_kind             text,
  flex_position         int,
  flex_target           int,
  event_type            text,
  adopted_from_handle   citext
)
language sql stable
as $$
  with page as (
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
           'completion'::text as feed_kind,
           case when c.period_start is not null then
             row_number() over (
               partition by c.habit_id, c.period_start
               order by c.completed_at
             )::int
           else null end as flex_position,
           null::text as event_type,
           null::uuid as adopted_from_user_id
    from public.habit_completions c
    where (c.owner_id = auth.uid()
           or public.are_friends(auth.uid(), c.owner_id))
      and not exists (
        select 1 from public.muted_habits m
        where m.user_id = auth.uid() and m.habit_id = c.habit_id
      )
      and (
        cursor_completed_at is null
        or (c.completed_at, c.id) < (cursor_completed_at, cursor_id)
      )

    union all

    select a.id,
           a.habit_id,
           a.owner_id,
           null::date as occurrence_date,
           null::date as period_start,
           null::timestamptz as completed_at,
           a.created_at,
           null::text as note,
           null::habit_visibility as visibility_override,
           a.created_at as sort_ts,
           'habit_created'::text as feed_kind,
           null::int as flex_position,
           a.event_type,
           a.adopted_from_user_id
    from public.habit_activity a
    join public.habits h on h.id = a.habit_id
    where a.event_type in ('created', 'adopted')
      and h.deleted_at is null
      and (a.owner_id = auth.uid()
           or (public.are_friends(auth.uid(), a.owner_id)
               and not public.is_blocked(auth.uid(), a.owner_id)
               and h.visibility in ('public', 'friends')))
      and not exists (
        select 1 from public.muted_habits m
        where m.user_id = auth.uid() and m.habit_id = a.habit_id
      )
      and (
        cursor_completed_at is null
        or (a.created_at, a.id) < (cursor_completed_at, cursor_id)
      )

    order by sort_ts desc, id desc
    limit greatest(page_limit, 1)
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
           (select count(*)::int
              from public.completion_likes l
              where l.completion_id = page.id)
         else
           (select count(*)::int
              from public.activity_likes l
              where l.activity_id = page.id)
         end as like_count,
         case when page.feed_kind = 'completion' then
           (select count(*)::int
              from public.completion_comments cc
              where cc.completion_id = page.id)
         else
           (select count(*)::int
              from public.activity_comments ac
              where ac.activity_id = page.id)
         end as comment_count,
         case when page.feed_kind = 'completion' then
           exists (
             select 1 from public.completion_likes l
             where l.completion_id = page.id and l.user_id = auth.uid()
           )
         else
           exists (
             select 1 from public.activity_likes l
             where l.activity_id = page.id and l.user_id = auth.uid()
           )
         end as viewer_liked,
         page.feed_kind,
         page.flex_position,
         h.target_count as flex_target,
         page.event_type,
         afp.handle as adopted_from_handle
  from page
  join public.profiles p on p.id = page.owner_id
  join public.habits   h on h.id = page.habit_id
  left join public.profiles afp on afp.id = page.adopted_from_user_id
  order by page.sort_ts desc, page.id desc;
$$;

grant execute on function public.fetch_feed_page(timestamptz, uuid, int) to authenticated;


-- ─── Webhook triggers via pg_net ─────────────────────────────────────────────
-- These replace the manual Supabase Dashboard webhooks. Each trigger POSTs the
-- new row as a JSON payload to the notify-on-engagement edge function, matching
-- the format that Dashboard webhooks use: { type, table, record, schema }.

create extension if not exists pg_net with schema extensions;

-- The trigger function reads the project URL and service role key from Supabase
-- Vault secrets. After running this migration, store them once in Vault:
--
--   select vault.create_secret('https://<project-ref>.supabase.co', 'supabase_url');
--   select vault.create_secret('<service-role-key>', 'service_role_key');
--
-- Or via Dashboard: Settings > Vault > New Secret.

create or replace function public.invoke_notify_on_engagement()
returns trigger language plpgsql security definer as $$
declare
  _project_url text;
  _service_key text;
begin
  select decrypted_secret into _project_url
    from vault.decrypted_secrets where name = 'supabase_url' limit 1;
  select decrypted_secret into _service_key
    from vault.decrypted_secrets where name = 'service_role_key' limit 1;

  if _project_url is null or _service_key is null then
    raise warning 'Missing supabase_url or service_role_key in Vault — skipping push';
    return new;
  end if;

  perform extensions.http_post(
    url     := _project_url || '/functions/v1/notify-on-engagement',
    body    := jsonb_build_object(
                 'type',   TG_OP,
                 'table',  TG_TABLE_NAME,
                 'schema', TG_TABLE_SCHEMA,
                 'record', to_jsonb(new)
               ),
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || _service_key
               )
  );

  return new;
end;
$$;

create trigger webhook_completion_likes
  after insert on public.completion_likes
  for each row execute function public.invoke_notify_on_engagement();

create trigger webhook_completion_comments
  after insert on public.completion_comments
  for each row execute function public.invoke_notify_on_engagement();

create trigger webhook_comment_likes
  after insert on public.comment_likes
  for each row execute function public.invoke_notify_on_engagement();

create trigger webhook_activity_likes
  after insert on public.activity_likes
  for each row execute function public.invoke_notify_on_engagement();

create trigger webhook_activity_comments
  after insert on public.activity_comments
  for each row execute function public.invoke_notify_on_engagement();

create trigger webhook_activity_comment_likes
  after insert on public.activity_comment_likes
  for each row execute function public.invoke_notify_on_engagement();

create trigger webhook_habit_activity
  after insert on public.habit_activity
  for each row execute function public.invoke_notify_on_engagement();
