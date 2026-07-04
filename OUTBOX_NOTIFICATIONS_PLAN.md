# Server-Side Notifications — Outbox Refactor Plan

> **Status:** planned, not started. To be implemented on a dedicated branch
> (`outbox-notifications`), branched from `main` after the architecture-review
> fixes land. Supersedes the per-table pg_net HTTP-trigger design.

## 1. Goal & non-goals

**Goal.** One reliable, observable path that turns any social event into (a) an
in-app notification row and (b) a push notification — with a single place to add
new event types, retries on failure, and no silent breakage.

**In scope**

- Push + in-app for every social surface: completion/activity likes & comments,
  comment likes, habit adoption, **rest likes/comments/comment-likes** (today:
  no notification at all), and **friend requests + acceptances** (today:
  push-only, no in-app row).
- Like-batching ("Alice and 3 others liked your run").
- Preference (`notify_likes` / `notify_comments`) and block enforcement.
- Retry, dead-letter, and a health signal so a broken pipeline is visible.

**Out of scope (for this refactor)**

- Local reminder notifications — already on-device (`expo-notifications`),
  unaffected, keep as is.
- New notification *types* beyond what already exists in the app.
- Rich push (images), notification grouping on the OS side, read-sync across
  devices. Possible v2.

## 2. Why we're replacing the current design

The review (see `CODE_REVIEW.md`) and the wiring investigation found that
notifications are wired in **3–4 independent places that must be hand-synced per
event type**, with no source of truth:

- In-app rows: `create_engagement_notification()` triggers (6 tables).
- Push: `invoke_notify_on_engagement()` pg_net HTTP triggers (7 tables) → the
  `notify-on-engagement` edge function.
- Batched-like push: a separate `pending_like_notifications` table + the
  `flush-like-notifications` function (**never scheduled** — pg_cron disabled).
- Client Realtime subscriptions (foreground only).

They have already drifted: push covers `habit_activity`, in-app doesn't; **neither
covers rests**; friend-request push exists but was never wired to a trigger and
has no in-app row. Fire-and-forget pg_net calls have no retry, no visibility.

The outbox pattern collapses this to **one enqueue + one dispatcher**.

## 3. Target architecture

```
 social write (like / comment / friend_request / adoption / rest_*)
        │  AFTER INSERT trigger  (in-transaction, no network)
        ▼
 ┌──────────────────────────────────────────────┐
 │ notifications  (the outbox = in-app list too) │
 │  … + push_state, push_attempts, push_not_before, push_batch_key │
 └──────────────────────────────────────────────┘
        │                          ▲
        │ pg_cron every 30–60s     │ mark sent / failed / skipped
        ▼                          │
 ┌──────────────────────────────────────────────┐
 │ Edge Function: notification-dispatcher        │
 │  claim due rows → prefs/blocks → batch likes  │
 │  → resolve tokens → Expo push → mark rows      │
 └──────────────────────────────────────────────┘
        │
        ▼
   Expo Push API → APNs / FCM → device
```

One trigger writes one row; the dispatcher owns all delivery. Adding a surface =
one INSERT trigger. In-app and push are consistent because they read the same
rows.

## 4. Data model

Reuse `notifications` as the outbox (single source of truth). New migration:

```sql
-- Widen the kind check to every social event we notify on.
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (
  kind in (
    'completion_like','completion_comment','comment_like',
    'activity_like','activity_comment','activity_comment_like',
    'habit_adopted',
    'rest_like','rest_comment','rest_comment_like',
    'friend_request','friend_request_accepted'
  )
);

-- Push-delivery state (in-app rows keep working; these only drive push).
alter table public.notifications
  add column push_state    text        not null default 'pending'
    check (push_state in ('pending','sending','sent','skipped','failed')),
  add column push_attempts int         not null default 0,
  add column push_not_before timestamptz not null default now(),
  add column push_claimed_at  timestamptz,
  add column push_batch_key    text;  -- e.g. 'completion_like:<target_id>'

-- Dispatcher scan index.
create index notifications_push_due
  on public.notifications (push_not_before)
  where push_state = 'pending';
```

`pending_like_notifications` is removed once cutover is verified (its role — the
batch window — moves to `push_not_before` + `push_batch_key`).

## 5. Enqueue layer (triggers)

Generalize `create_engagement_notification()` into `enqueue_notification()` that,
per source table, resolves `(kind, actor, recipient, target, comment)`, then:

1. Skip self-actions (`actor = recipient`) and null recipients.
2. **Skip if blocked** (`is_blocked(actor, recipient)`) — closes a current gap
   where a blocked user's like still creates an in-app row.
3. Set batching metadata by kind:
   - likes → `push_batch_key = kind || ':' || target`, `push_not_before = now() + BATCH_DELAY` (e.g. 10 min).
   - comments / friend-requests / adoption → no batch key, `push_not_before = now()` (near-instant).
4. `insert into notifications (...)`.

Add triggers on the currently-unwired tables: `rest_likes`, `rest_comments`,
`rest_comment_likes`, and `friend_requests` (INSERT status=pending →
`friend_request`; UPDATE pending→accepted → `friend_request_accepted`).

**Cutover:** in the same migration, `drop` the old `invoke_notify_on_engagement`
pg_net triggers and function so we never double-send (old direct-push + new
dispatcher). `create_engagement_notification` is replaced by `enqueue_notification`.

## 6. Dispatcher (edge function)

Rename/replace `flush-like-notifications` → `notification-dispatcher`. Keeps the
`x-webhook-secret` gate (SEC-2) and the DeviceNotRegistered token cleanup. New
control flow:

```
0. Single-flight: pg_try_advisory_lock(<const>); exit if not acquired.
1. Reclaim stragglers: rows in 'sending' with push_claimed_at < now()-5min → 'pending'.
2. Claim a batch:
     update notifications set push_state='sending', push_attempts=push_attempts+1,
            push_claimed_at=now()
     where id in (
       select id from notifications
       where push_state='pending' and push_not_before<=now() and push_attempts<MAX_ATTEMPTS
       order by push_not_before
       limit N for update skip locked)
     returning *;
3. Drop rows failing prefs/blocks → mark 'skipped' (no push, in-app row stays).
     - likes gated by recipient.notify_likes; comments by notify_comments.
     - re-check is_blocked (block may post-date enqueue).
4. Group by push_batch_key:
     - batched likes → one message: "@alice and 3 others liked your run"
       (distinct actor count; newest actor handle for the name).
     - everything else → one message per row.
5. Resolve recipient tokens from expo_push_tokens; compose Expo messages.
6. POST to Expo in chunks of 100. On ticket ok → rows 'sent'.
   On error / no token → back to 'pending' (retry) unless push_attempts>=MAX → 'failed'.
   DeviceNotRegistered ticket → delete that token row.
7. Prune notifications older than 90 days (existing behavior).
8. release advisory lock.
```

At-least-once delivery (a crash between Expo-send and mark re-sends next run);
duplicate push is tolerable, and the `sending`+reclaim window keeps it rare.
`MAX_ATTEMPTS` (~5) bounds retries; `'failed'` rows are the dead-letter, queryable.

## 7. Scheduling

**Prerequisite:** enable `pg_cron` (`create extension pg_cron;` — not currently
enabled; `cron.job` doesn't exist). Then:

```sql
select cron.schedule('notification-dispatch', '* * * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='supabase_url')
           || '/functions/v1/notification-dispatcher',
    headers := jsonb_build_object(
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='service_role_key'),
      'x-webhook-secret', (select decrypted_secret from vault.decrypted_secrets where name='webhook_secret'))
  ) $$);
```

Every-minute cadence gives ≤60s latency for comments/requests, and the
`BATCH_DELAY` window collapses likes. **Fallback** if pg_cron is unavailable on
the plan: an external scheduler (GitHub Actions cron / cron-job.org) hitting the
function URL with the secret header — same contract.

## 8. Reliability & idempotency

- **Atomicity:** the notification row commits in the same transaction as the
  source write. No lost events, no fire-and-forget from inside a txn.
- **Concurrency:** advisory lock → one dispatcher at a time; `for update skip
  locked` as a second guard.
- **Retry / dead-letter:** `push_attempts` + `'failed'` state; failures don't
  block other rows.
- **Crash safety:** the `'sending'` state + stale reclaim re-queues rows a
  crashed run had claimed.

## 9. Client changes

- **Verify token registration** actually runs in production builds:
  `registerPushToken` (called from `auth.tsx`) needs a real EAS build + APNs
  key/FCM config; it no-ops in Expo Go and without an EAS `projectId`. Confirm
  the prod build path end-to-end.
- **Render new kinds** in the Notifications tab (`notifications.tsx` /
  `notification-item.tsx`): `rest_*`, `friend_request`, `friend_request_accepted`.
  Friend requests appearing in the list is a UX decision (see §11).
- **Badges via Realtime, not polling:** replace the 30s polling in
  `unread-count-provider` / `pending-count-provider` with the Realtime
  subscriptions already open for these tables (this is also review item EFF/L1).
- Optional: set the app-icon badge from unread count
  (`Notifications.setBadgeCountAsync`) — currently never set.

## 10. Observability (do not skip — silent breakage is the root cause here)

- **Health query / view:** oldest `pending` age and `failed` count, e.g.
  `select count(*) filter (where push_state='pending' and push_not_before < now()-interval '10 min') as stuck,
          count(*) filter (where push_state='failed') as dead from notifications;`
- Dispatcher logs a one-line summary per run (claimed / sent / skipped / failed).
- A trivial alert (even a scheduled query that emails on `stuck > 0`) so the next
  outage is noticed in minutes, not by a user asking why nobody got a like.

## 11. Open decisions (need a product call before build)

1. **Friend requests in the Notifications tab?** Recommend yes (one inbox), while
   keeping the Friends-tab pending badge. Alternative: push-only, no list row.
2. **Like batch window** (`BATCH_DELAY`): 10 min proposed. Shorter = snappier,
   less collapsing.
3. **Comment/request latency:** 1-min dispatch cadence proposed (≤60s). Instant
   would require a fast-path and reintroduces a second path — not recommended.
4. **pg_cron vs external scheduler** (§7) — confirm pg_cron is enabled on the
   plan.
5. **Expo receipts:** v1 handles send-time tickets only; async receipt polling
   (delivery confirmation) is a v2 refinement.

## 12. Rollout (single cutover, no double-push)

1. **Prep:** enable `pg_cron`; store `webhook_secret` in Vault (done for SEC-2);
   confirm prod push-token registration.
2. **Migration A (schema):** widen kind check; add push columns + index.
3. **Migration B (enqueue):** `enqueue_notification` + triggers for all surfaces
   (incl. rests + friend_requests); **drop** old `invoke_notify_on_engagement`
   triggers/function and `create_engagement_notification`.
4. **Dispatcher:** deploy `notification-dispatcher`; schedule via pg_cron.
5. **Backfill (optional):** migrate any rows from `pending_like_notifications`,
   then drop it.
6. **Client:** render new kinds; switch badges to Realtime.
7. **Verify** end-to-end (see §13); watch the health query for a day; then remove
   dead code (`notify-on-engagement` if fully replaced, `flush-like-notifications`
   old name, `pending_like_notifications`).

## 13. Testing

- **Pure functions (repo style, no mocks):** batch-collapsing (rows → messages),
  message composition (title/body/truncation), pref/block filtering. These are
  the correctness core and are unit-testable.
- **Migration:** apply to a scratch/branch DB; assert triggers fire and rows land
  with correct `push_state`/`push_batch_key`.
- **E2E smoke:** device A likes device B's post → row appears in-app on B → within
  a cadence, B's device gets a push. Repeat for comment, friend-request, rest.
- **Failure drills:** bad token → `failed` after MAX_ATTEMPTS, other rows still
  deliver; dispatcher killed mid-run → straggler reclaimed, no permanent loss.

## 14. Task breakdown (rough order & size)

| # | Task | Size |
|---|------|------|
| 1 | Enable pg_cron; verify a no-op scheduled call reaches an edge function | S |
| 2 | Migration A: kind check + push columns + index | S |
| 3 | `enqueue_notification` + triggers (all surfaces incl. rests/friends); drop old push triggers | M |
| 4 | `notification-dispatcher` function: claim/batch/send/mark + token cleanup | M–L |
| 5 | pg_cron schedule for the dispatcher | S |
| 6 | Pure-function tests (batch/compose/filter) | M |
| 7 | Client: render new kinds; Realtime-driven badges | M |
| 8 | Observability: health view + dispatcher logging + simple alert | S |
| 9 | E2E + failure drills; then remove dead code & `pending_like_notifications` | M |

Critical path is 1 → 2 → 3 → 4 → 5; client (7) and observability (8) can land in
parallel once the schema (2) exists.
