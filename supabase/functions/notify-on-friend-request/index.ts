// Edge Function: push notifications for friend request events.
//
// Handles friend_requests:
//   - INSERT (status=pending)    → notify to_user
//   - UPDATE (pending→accepted)  → notify from_user (original sender)
//
// ⚠️ NOT CURRENTLY WIRED. Nothing invokes this function: there is no pg_net
// trigger on friend_requests and no Dashboard webhook (verified against the
// live DB, 2026-07). Friend-request and acceptance pushes therefore never
// fire. The project moved from Dashboard webhooks to version-controlled pg_net
// triggers (see 20260609000000_adopt_habit.sql) but this function was never
// migrated. To enable, add INSERT + UPDATE pg_net triggers on friend_requests
// mirroring invoke_notify_on_engagement — reading supabase_url /
// service_role_key / webhook_secret from Vault and sending the
// x-webhook-secret header this function now requires.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { verifyWebhookSecret } from "../_shared/verify-webhook.ts";

serve(async (req) => {
  const denied = verifyWebhookSecret(req);
  if (denied) return denied;

  const payload = await req.json();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { type, record, old_record } = payload;

  if (type === "INSERT" && record.status === "pending") {
    await notifyNewRequest(supabase, record.from_user, record.to_user, record.id);
  } else if (
    type === "UPDATE" &&
    record.status === "accepted" &&
    old_record?.status === "pending"
  ) {
    await notifyAccepted(supabase, record.to_user, record.from_user, record.id);
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});

async function notifyNewRequest(
  supabase: ReturnType<typeof createClient>,
  fromUserId: string,
  toUserId: string,
  requestId: string,
) {
  const { data: sender } = await supabase
    .from("profiles")
    .select("handle")
    .eq("id", fromUserId)
    .single();

  const { data: tokens } = await supabase
    .from("expo_push_tokens")
    .select("token")
    .eq("user_id", toUserId);

  if (!tokens?.length) return;

  const name = sender?.handle ? `@${sender.handle}` : "Someone";
  const messages = tokens.map((t: { token: string }) => ({
    to: t.token,
    title: "Friend request",
    body: `${name} sent you a friend request`,
    data: { kind: "friend_request", request_id: requestId },
    sound: "default",
  }));

  await sendExpoPush(messages);
}

async function notifyAccepted(
  supabase: ReturnType<typeof createClient>,
  accepterId: string,
  originalSenderId: string,
  requestId: string,
) {
  const { data: accepter } = await supabase
    .from("profiles")
    .select("handle")
    .eq("id", accepterId)
    .single();

  const { data: tokens } = await supabase
    .from("expo_push_tokens")
    .select("token")
    .eq("user_id", originalSenderId);

  if (!tokens?.length) return;

  const name = accepter?.handle ? `@${accepter.handle}` : "Someone";
  const messages = tokens.map((t: { token: string }) => ({
    to: t.token,
    title: "Friend request accepted",
    body: `${name} accepted your friend request`,
    data: { kind: "friend_request_accepted", request_id: requestId },
    sound: "default",
  }));

  await sendExpoPush(messages);
}

async function sendExpoPush(messages: unknown[]) {
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(batch),
    });
    if (!res.ok) {
      console.error("Expo push error:", await res.text());
    }
  }
}
