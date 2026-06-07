# notify-on-engagement

Edge Function that sends Expo push notifications when someone engages with a
user's content on the feed.

## Triggers (DB webhooks → this function)

Configured in Supabase Studio under **Database → Webhooks**. One webhook per
table. All POST to `https://<project>.functions.supabase.co/notify-on-engagement`
with `Authorization: Bearer <service_role_key>`.

| Webhook | Table | Events | Kind |
| --- | --- | --- | --- |
| `like_on_completion` | `completion_likes` | INSERT | `completion_like` |
| `comment_on_completion` | `completion_comments` | INSERT | `completion_comment` |
| `like_on_comment` | `comment_likes` | INSERT | `comment_like` |
| `like_on_activity` | `activity_likes` | INSERT | `activity_like` |
| `comment_on_activity` | `activity_comments` | INSERT | `activity_comment` |
| `like_on_activity_comment` | `activity_comment_likes` | INSERT | `activity_comment_like` |

## Behavior

1. Resolves the content owner as recipient. Skips self-actions.
2. Always inserts into the `notifications` table (in-app list).
3. Checks recipient's `notify_likes` / `notify_comments` preference.
4. **Comments** → sends push immediately via Expo push API.
5. **Likes** → inserts into `pending_like_notifications` for batched delivery
   (flushed by the `flush-like-notifications` cron function every 15 min).

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
