-- ════════════════════════════════════════════════════════════════════════════
-- OUTBOX NOTIFICATIONS — SQL smoke test
--
-- Run in the Supabase SQL editor (runs as `postgres`, which bypasses RLS and may
-- call the service-role-only RPCs). Exercises the enqueue triggers, like
-- batching, self/block/pref skips, and the claim → mark cycle — WITHOUT any
-- device or push. Everything is created inside a transaction and ROLLED BACK, so
-- nothing is persisted.
--
-- SETUP: replace the two UUIDs below with real test-account user ids that exist
-- in `public.profiles` (any two distinct accounts you control).
--
-- Any assertion failure raises an exception (and aborts → nothing saved). A full
-- pass prints "PASS n: ..." notices and ends with "ALL PASS".
-- ════════════════════════════════════════════════════════════════════════════

begin;

do $$
declare
  user_a uuid := 'REPLACE-WITH-RECIPIENT-UUID'; -- owner / recipient
  user_b uuid := 'REPLACE-WITH-ACTOR-UUID';     -- the one who likes/comments
  v_habit uuid; v_comp uuid; v_comp2 uuid; v_rest uuid;
  n int; k text; s text;
  claimed int;
begin
  -- ── Fixtures owned by A ────────────────────────────────────────────────────
  insert into public.habits (lineage_id, owner_id, kind, title, timezone, target_count, target_period)
    values (gen_random_uuid(), user_a, 'flex', 'Outbox test habit', 'UTC', 1, 'week')
    returning id into v_habit;
  insert into public.habit_completions (habit_id, owner_id, period_start)
    values (v_habit, user_a, current_date) returning id into v_comp;
  insert into public.habit_rests (habit_id, owner_id, start_date, end_date)
    values (v_habit, user_a, current_date, current_date + 7) returning id into v_rest;

  -- ── 1. B likes A's completion → one PENDING, BATCHED notification ──────────
  insert into public.completion_likes (completion_id, user_id) values (v_comp, user_b);
  select count(*), max(push_state), max(push_batch_key) into n, s, k
    from public.notifications
    where user_id = user_a and kind = 'completion_like' and target_id = v_comp;
  assert n = 1, 'T1: expected 1 like notification, got ' || n;
  assert s = 'pending', 'T1: expected pending, got ' || s;
  assert k = 'completion_like:' || v_comp::text, 'T1: bad batch_key ' || coalesce(k,'null');
  raise notice 'PASS 1: like enqueued (pending, batched)';

  -- ── 2. Self-action is skipped (A likes own completion) ─────────────────────
  insert into public.completion_likes (completion_id, user_id) values (v_comp, user_a);
  select count(*) into n from public.notifications where actor_id = user_a and user_id = user_a;
  assert n = 0, 'T2: self-like should not notify, got ' || n;
  raise notice 'PASS 2: self-action skipped';

  -- ── 3. Comment is IMMEDIATE (not batched) ─────────────────────────────────
  insert into public.completion_comments (completion_id, author_id, body)
    values (v_comp, user_b, 'nice work');
  select count(*), max(push_batch_key) into n, k
    from public.notifications where user_id = user_a and kind = 'completion_comment';
  assert n = 1, 'T3: expected 1 comment notification, got ' || n;
  assert k is null, 'T3: comment should not be batched';
  raise notice 'PASS 3: comment enqueued (immediate)';

  -- ── 4. Rest like — previously produced NO notification at all ─────────────
  insert into public.rest_likes (rest_id, user_id) values (v_rest, user_b);
  select count(*) into n from public.notifications where user_id = user_a and kind = 'rest_like';
  assert n = 1, 'T4: expected 1 rest_like notification, got ' || n;
  raise notice 'PASS 4: rest_like enqueued';

  -- ── 5. Friend request + acceptance ────────────────────────────────────────
  insert into public.friend_requests (from_user, to_user) values (user_b, user_a);
  select count(*) into n from public.notifications where user_id = user_a and kind = 'friend_request';
  assert n = 1, 'T5a: expected 1 friend_request notification, got ' || n;
  update public.friend_requests set status = 'accepted', responded_at = now()
    where from_user = user_b and to_user = user_a;
  select count(*) into n from public.notifications where user_id = user_b and kind = 'friend_request_accepted';
  assert n = 1, 'T5b: expected 1 friend_request_accepted notification, got ' || n;
  raise notice 'PASS 5: friend request + acceptance enqueued';

  -- ── 6. Block suppresses notifications entirely ────────────────────────────
  insert into public.blocks (blocker_id, blocked_id) values (user_a, user_b);
  insert into public.habit_completions (habit_id, owner_id, period_start)
    values (v_habit, user_a, current_date - 1) returning id into v_comp2;
  insert into public.completion_likes (completion_id, user_id) values (v_comp2, user_b);
  select count(*) into n from public.notifications where user_id = user_a and target_id = v_comp2;
  assert n = 0, 'T6: blocked actor should not notify, got ' || n;
  delete from public.blocks where blocker_id = user_a and blocked_id = user_b;
  raise notice 'PASS 6: block suppresses notification';

  -- ── 7. claim → mark cycle ─────────────────────────────────────────────────
  -- Make the comment row due now, then claim it.
  update public.notifications set push_not_before = now() - interval '1 minute'
    where user_id = user_a and kind = 'completion_comment';
  select count(*) into claimed from public.claim_due_notifications(200);
  assert claimed >= 1, 'T7a: claim returned no rows';
  select push_state into s from public.notifications
    where user_id = user_a and kind = 'completion_comment';
  assert s = 'sending', 'T7a: expected sending after claim, got ' || s;
  raise notice 'PASS 7a: claim marks rows sending';

  perform public.mark_notifications_pushed(
    array(select id from public.notifications where user_id = user_a and kind = 'completion_comment'),
    array[]::uuid[], array[]::uuid[]);
  select push_state into s from public.notifications
    where user_id = user_a and kind = 'completion_comment';
  assert s = 'sent', 'T7b: expected sent after mark, got ' || s;
  raise notice 'PASS 7b: mark_notifications_pushed sets sent';

  -- ── 8. Preference off → claim marks the like SKIPPED ──────────────────────
  update public.profiles set notify_likes = false where id = user_a;
  update public.notifications set push_not_before = now() - interval '1 minute'
    where user_id = user_a and kind = 'completion_like';
  perform public.claim_due_notifications(200);
  select push_state into s from public.notifications
    where user_id = user_a and kind = 'completion_like' and target_id = v_comp;
  assert s = 'skipped', 'T8: expected skipped when notify_likes off, got ' || s;
  raise notice 'PASS 8: pref off → push skipped (in-app row kept)';

  raise notice 'ALL PASS';
end $$;

rollback;
