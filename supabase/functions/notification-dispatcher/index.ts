// Edge Function: notification-dispatcher.
//
// The single push-delivery worker for the outbox (see OUTBOX_NOTIFICATIONS_PLAN.md).
// Runs on a schedule (pg_cron, ~1 min). Drains `notifications` rows whose push is
// due: claims them, composes one Expo message per group (likes collapse by
// target), sends, and marks each row sent/failed/skipped. Retries are automatic
// (a 'failed' send returns the row to 'pending' until attempts exhaust).
//
// WIRING: scheduled via pg_cron (migration 20260705000002). Requires the
// x-webhook-secret header (see _shared/verify-webhook.ts) and these function
// secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, WEBHOOK_SECRET.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { verifyWebhookSecret } from "../_shared/verify-webhook.ts";
import { composeMessages, type ClaimedRow } from "./compose.ts";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const RETENTION_DAYS = 90;
const MAX_ROWS = 200;

serve(async (req) => {
  const denied = verifyWebhookSecret(req);
  if (denied) return denied;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 1. Claim due rows (also retires pref/blocked rows and reclaims stalled ones).
  const { data: claimed, error: claimErr } = await supabase.rpc(
    "claim_due_notifications",
    { max_rows: MAX_ROWS },
  );
  if (claimErr) {
    console.error("claim_due_notifications failed:", claimErr);
    return json({ error: "claim_failed" }, 500);
  }
  const rows = (claimed ?? []) as ClaimedRow[];
  if (rows.length === 0) {
    await prune(supabase);
    return json({ claimed: 0, sent: 0 });
  }

  // 2. Collapse to one message per group (pure).
  const groups = composeMessages(rows);

  // 3. Resolve recipient push tokens in one query.
  const recipientIds = [...new Set(groups.map((g) => g.recipientId))];
  const { data: tokenRows } = await supabase
    .from("expo_push_tokens")
    .select("user_id, token")
    .in("user_id", recipientIds);
  const tokensByUser = new Map<string, string[]>();
  for (const t of (tokenRows ?? []) as { user_id: string; token: string }[]) {
    const list = tokensByUser.get(t.user_id) ?? [];
    list.push(t.token);
    tokensByUser.set(t.user_id, list);
  }

  // 4. Build Expo messages. Track which notification ids each message covers.
  const skipped = new Set<string>(); // no token → terminal, don't retry
  const deliverable = new Set<string>(); // had ≥1 token → expect a result
  type Msg = { to: string; title: string; body: string; data: unknown; sound: "default"; ids: string[] };
  const messages: Msg[] = [];
  for (const g of groups) {
    const tokens = tokensByUser.get(g.recipientId) ?? [];
    if (tokens.length === 0) {
      g.notificationIds.forEach((id) => skipped.add(id));
      continue;
    }
    g.notificationIds.forEach((id) => deliverable.add(id));
    for (const token of tokens) {
      messages.push({ to: token, title: g.title, body: g.body, data: g.data, sound: "default", ids: g.notificationIds });
    }
  }

  // 5. Send in chunks of 100; a notification is 'sent' if any of its messages ok.
  const sent = new Set<string>();
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    let tickets: { status?: string; details?: { error?: string } }[] = [];
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(batch.map(({ to, title, body, data, sound }) => ({ to, title, body, data, sound }))),
      });
      if (!res.ok) {
        console.error("Expo push HTTP error:", await res.text());
        continue; // leave this batch's ids undelivered → they become 'failed'/retry
      }
      tickets = (await res.json())?.data ?? [];
    } catch (err) {
      console.error("Expo push threw:", err);
      continue;
    }
    for (let j = 0; j < batch.length; j++) {
      const ticket = tickets[j];
      if (ticket?.status === "ok") {
        batch[j].ids.forEach((id) => sent.add(id));
      } else if (ticket?.details?.error === "DeviceNotRegistered") {
        await supabase.from("expo_push_tokens").delete().eq("token", batch[j].to);
      }
    }
  }

  // 6. deliverable-but-not-sent → failed (retry/dead-letter); no-token → skipped.
  const failed = [...deliverable].filter((id) => !sent.has(id));
  const { error: markErr } = await supabase.rpc("mark_notifications_pushed", {
    p_sent: [...sent],
    p_failed: failed,
    p_skipped: [...skipped],
  });
  if (markErr) console.error("mark_notifications_pushed failed:", markErr);

  await prune(supabase);

  const summary = { claimed: rows.length, sent: sent.size, failed: failed.length, skipped: skipped.size };
  console.log("dispatch:", JSON.stringify(summary));
  return json(summary);
});

async function prune(supabase: ReturnType<typeof createClient>) {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString();
  await supabase.from("notifications").delete().lt("created_at", cutoff);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
