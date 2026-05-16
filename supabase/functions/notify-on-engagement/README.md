# notify-on-engagement

Edge Function that sends Expo push notifications when someone engages with a
user's content on the feed.

Body is intentionally not implemented yet — this README is a spec so the
follow-up PR has zero context-discovery cost.

## Triggers (DB webhooks → this function)

Configured in Supabase Studio under **Database → Webhooks**. One webhook per
event. All POST to `https://<project>.functions.supabase.co/notify-on-engagement`
with `Authorization: Bearer <service_role_key>`.

| Webhook | Table | Events | Payload event |
| --- | --- | --- | --- |
| `like_on_completion` | `completion_likes` | INSERT | `completion_like` |
| `comment_on_completion` | `completion_comments` | INSERT | `completion_comment` |
| `like_on_comment` | `comment_likes` | INSERT | `comment_like` |

## Function shape

```ts
// supabase/functions/notify-on-engagement/index.ts
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const payload = await req.json();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 1. Resolve recipient(s) based on payload.table + payload.record.
  // 2. Fetch their expo_push_tokens.
  // 3. POST to https://exp.host/--/api/v2/push/send with a list of messages.
  // 4. Handle DeviceNotRegistered receipts by deleting the token row.
});
```

## Recipient resolution

| Event | Recipient(s) |
| --- | --- |
| `completion_like` | Owner of `habit_completions[completion_id]`. Skip if `user_id == owner_id` (self-like). |
| `completion_comment` | Owner of the completion + distinct prior commenters on the same completion. Exclude the new comment's `author_id` from both lists. |
| `comment_like` | Author of `completion_comments[comment_id]`. Skip if self-like. |

## Message body

| Event | Title | Body |
| --- | --- | --- |
| `completion_like` | "&lt;display_name&gt; liked your post" | "&lt;display_name&gt; liked your &lt;habit_title&gt; completion." |
| `completion_comment` | "&lt;display_name&gt; commented" | First 80 chars of comment body. |
| `comment_like` | "&lt;display_name&gt; liked your comment" | First 80 chars of comment body. |

Pass `data: { kind, completion_id, comment_id? }` so the app can deep-link to
the post on tap.

## Expo Push API

Batch up to 100 messages per call. Treat 200 + per-ticket errors per
[Expo docs](https://docs.expo.dev/push-notifications/sending-notifications/).
DeviceNotRegistered → delete the token row.

## Not in scope here

- A separate friend-completion-notification webhook. We explicitly decided
  push is **engagement only** — see FEED_PLAN.md.
- Per-user notification preferences. Defaults to always-on for engagement.
  When the preferences PR lands, this function will read a `notify_*` boolean
  off `profiles` before sending.
