// Edge Function: flush batched like notifications + prune old notifications.
//
// Intended to run on a ~1-minute schedule: groups pending likes older than
// 15 min by (user_id, kind, target_id), sends one Expo push per group, deletes
// the flushed rows, and cleans up notifications older than 90 days.
//
// ⚠️ NOT CURRENTLY SCHEDULED. pg_cron is not enabled on this project (the
// cron.job relation does not exist) and nothing else invokes this function
// (verified 2026-07). Consequences while unscheduled:
//   - notify-on-engagement queues every LIKE into pending_like_notifications
//     expecting this job to deliver it — so batched like pushes are NEVER sent
//     and that table grows unbounded (only comment pushes, which send inline,
//     work).
//   - the 90-day notifications cleanup never runs.
// To enable: `create extension pg_cron;` then schedule a call that sends the
// x-webhook-secret header this function now requires, e.g.
//   select cron.schedule('flush-likes', '* * * * *',
//     $$ select net.http_post(url := ..., headers := jsonb_build_object(
//          'x-webhook-secret', (select decrypted_secret from vault.decrypted_secrets
//                               where name = 'webhook_secret'))) $$);

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { verifyWebhookSecret } from "../_shared/verify-webhook.ts";

const BATCH_WINDOW_MINUTES = 15;
const RETENTION_DAYS = 90;

interface PendingRow {
  id: string;
  user_id: string;
  kind: string;
  actor_id: string;
  target_id: string;
  comment_id: string | null;
  created_at: string;
}

interface Group {
  userId: string;
  kind: string;
  targetId: string;
  commentId: string | null;
  actorIds: string[];
  rowIds: string[];
}

serve(async (req) => {
  const denied = verifyWebhookSecret(req);
  if (denied) return denied;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const cutoff = new Date(Date.now() - BATCH_WINDOW_MINUTES * 60_000).toISOString();

  const { data: rows, error } = await supabase
    .from("pending_like_notifications")
    .select("*")
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error || !rows?.length) {
    await cleanupOldNotifications(supabase);
    return json({ flushed: 0 });
  }

  const groups = groupRows(rows as PendingRow[]);
  let sent = 0;

  for (const group of groups) {
    const { data: prefs } = await supabase
      .from("profiles")
      .select("notify_likes")
      .eq("id", group.userId)
      .single();

    if (!prefs?.notify_likes) {
      await deleteRows(supabase, group.rowIds);
      continue;
    }

    const { data: tokens } = await supabase
      .from("expo_push_tokens")
      .select("token")
      .eq("user_id", group.userId);

    if (!tokens?.length) {
      await deleteRows(supabase, group.rowIds);
      continue;
    }

    const message = await composeMessage(supabase, group);
    if (!message) {
      await deleteRows(supabase, group.rowIds);
      continue;
    }

    const messages = tokens.map((t: { token: string }) => ({
      to: t.token,
      title: message.title,
      body: message.body,
      data: {
        kind: group.kind,
        target_id: group.targetId,
        comment_id: group.commentId,
      },
      sound: "default",
    }));

    await sendExpoPush(messages, supabase);
    await deleteRows(supabase, group.rowIds);
    sent++;
  }

  await cleanupOldNotifications(supabase);
  return json({ flushed: sent, groups: groups.length });
});

function groupRows(rows: PendingRow[]): Group[] {
  const map = new Map<string, Group>();

  for (const row of rows) {
    const key = `${row.user_id}:${row.kind}:${row.target_id}`;
    const existing = map.get(key);
    if (existing) {
      if (!existing.actorIds.includes(row.actor_id)) {
        existing.actorIds.push(row.actor_id);
      }
      existing.rowIds.push(row.id);
    } else {
      map.set(key, {
        userId: row.user_id,
        kind: row.kind,
        targetId: row.target_id,
        commentId: row.comment_id,
        actorIds: [row.actor_id],
        rowIds: [row.id],
      });
    }
  }

  return [...map.values()];
}

async function composeMessage(
  supabase: ReturnType<typeof createClient>,
  group: Group,
): Promise<{ title: string; body: string } | null> {
  const { data: firstActor } = await supabase
    .from("profiles")
    .select("handle")
    .eq("id", group.actorIds[0])
    .single();

  if (!firstActor) return null;

  const name = `@${firstActor.handle}`;
  const othersCount = group.actorIds.length - 1;
  const actorText = othersCount > 0
    ? `${name} and ${othersCount} ${othersCount === 1 ? "other" : "others"}`
    : name;

  let habitTitle = "";
  if (group.kind === "completion_like") {
    const { data } = await supabase
      .from("habit_completions")
      .select("habit_id")
      .eq("id", group.targetId)
      .single();
    if (data) {
      const { data: habit } = await supabase
        .from("habits")
        .select("title")
        .eq("id", data.habit_id)
        .single();
      habitTitle = habit?.title ?? "";
    }
  } else if (group.kind === "activity_like") {
    const { data } = await supabase
      .from("habit_activity")
      .select("habit_id")
      .eq("id", group.targetId)
      .single();
    if (data) {
      const { data: habit } = await supabase
        .from("habits")
        .select("title")
        .eq("id", data.habit_id)
        .single();
      habitTitle = habit?.title ?? "";
    }
  }

  let verb: string;
  switch (group.kind) {
    case "completion_like":
      verb = habitTitle
        ? `liked your ${habitTitle} completion`
        : "liked your completion";
      break;
    case "activity_like":
      verb = habitTitle ? `liked your ${habitTitle}` : "liked your habit";
      break;
    case "comment_like":
    case "activity_comment_like":
      verb = "liked your comment";
      break;
    default:
      verb = "liked your post";
  }

  return {
    title: `${actorText} ${verb}`,
    body: `${actorText} ${verb}`,
  };
}

async function deleteRows(
  supabase: ReturnType<typeof createClient>,
  ids: string[],
) {
  await supabase
    .from("pending_like_notifications")
    .delete()
    .in("id", ids);
}

async function cleanupOldNotifications(
  supabase: ReturnType<typeof createClient>,
) {
  const cutoff = new Date(
    Date.now() - RETENTION_DAYS * 24 * 60 * 60_000,
  ).toISOString();

  await supabase
    .from("notifications")
    .delete()
    .lt("created_at", cutoff);
}

async function sendExpoPush(
  messages: unknown[],
  supabase: ReturnType<typeof createClient>,
) {
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
      continue;
    }

    const { data } = await res.json();
    if (!data) continue;

    for (let j = 0; j < data.length; j++) {
      if (data[j]?.details?.error === "DeviceNotRegistered") {
        const token = (messages[i + j] as { to: string }).to;
        await supabase
          .from("expo_push_tokens")
          .delete()
          .eq("token", token);
      }
    }
  }
}

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
  });
}
