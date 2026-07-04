# notify-on-engagement

Edge Function that sends Expo push notifications when someone engages with a
user's content on the feed.

## Triggers (pg_net SQL triggers → this function)

**Not** Dashboard webhooks. The wiring lives in
`supabase/migrations/20260609000000_adopt_habit.sql`: one `after insert` trigger
per table, all running `invoke_notify_on_engagement()`, which POSTs to this
function via `pg_net`. The trigger reads `supabase_url` / `service_role_key` /
`webhook_secret` from Vault and sends `Authorization: Bearer <service_role_key>`
plus the `x-webhook-secret` header this function requires (see
`_shared/verify-webhook.ts`).

| Trigger | Table | Events | Kind |
| --- | --- | --- | --- |
| `webhook_completion_likes` | `completion_likes` | INSERT | `completion_like` |
| `webhook_completion_comments` | `completion_comments` | INSERT | `completion_comment` |
| `webhook_comment_likes` | `comment_likes` | INSERT | `comment_like` |
| `webhook_activity_likes` | `activity_likes` | INSERT | `activity_like` |
| `webhook_activity_comments` | `activity_comments` | INSERT | `activity_comment` |
| `webhook_activity_comment_likes` | `activity_comment_likes` | INSERT | `activity_comment_like` |
| `webhook_habit_activity` | `habit_activity` | INSERT | `habit_adopted` |

## Behavior

1. Resolves the content owner as recipient. Skips self-actions.
2. Always inserts into the `notifications` table (in-app list).
3. Checks recipient's `notify_likes` / `notify_comments` preference.
4. **Comments** → sends push immediately via Expo push API.
5. **Likes** → inserts into `pending_like_notifications` for batched delivery by
   the `flush-like-notifications` function. ⚠️ That flush job is **not currently
   scheduled** (pg_cron is disabled), so queued like pushes are not delivered
   until it is — see that function's header.

## Recipient resolution

| Event | Recipient |
| --- | --- |
| `completion_like` | Owner of the completion. Skip if self-like. |
| `completion_comment` | Owner of the completion. Skip if own completion. |
| `comment_like` | Author of the comment. Skip if self-like. |
| `activity_like` | Owner of the activity. Skip if self-like. |
| `activity_comment` | Owner of the activity. Skip if own activity. |
| `activity_comment_like` | Author of the activity comment. Skip if self-like. |

## Push payload

```json
{
  "to": "<expo_token>",
  "title": "@handle commented",
  "body": "<first 80 chars of comment>",
  "data": { "kind": "completion_comment", "target_id": "<uuid>", "comment_id": "<uuid>" },
  "sound": "default"
}
```

DeviceNotRegistered → deletes the stale token row.
