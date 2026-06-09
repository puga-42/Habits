// Edge Function: push notifications for engagement events (likes & comments).
//
// Triggered by DB webhooks on 6 tables (INSERT only):
//   completion_likes, completion_comments, comment_likes,
//   activity_likes, activity_comments, activity_comment_likes
//
// For comments: sends push immediately.
// For likes: queues into pending_like_notifications for batched delivery.
// Always inserts into notifications table for the in-app list.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Kind =
  | "completion_like"
  | "completion_comment"
  | "comment_like"
  | "activity_like"
  | "activity_comment"
  | "activity_comment_like"
  | "habit_adopted";

interface Resolved {
  kind: Kind;
  recipientId: string;
  actorId: string;
  targetId: string;
  commentId: string | null;
  body: string | null;
}

const TABLE_TO_KIND: Record<string, Kind> = {
  completion_likes: "completion_like",
  completion_comments: "completion_comment",
  comment_likes: "comment_like",
  activity_likes: "activity_like",
  activity_comments: "activity_comment",
  activity_comment_likes: "activity_comment_like",
  habit_activity: "habit_adopted",
};

const LIKE_KINDS: Kind[] = [
  "completion_like",
  "comment_like",
  "activity_like",
  "activity_comment_like",
];

serve(async (req) => {
  const payload = await req.json();
  if (payload.type !== "INSERT") {
    return json({ skipped: true });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let kind = TABLE_TO_KIND[payload.table];
  if (!kind) return json({ skipped: "unknown table" });

  if (kind === "habit_adopted" && payload.record.event_type !== "adopted") {
    return json({ skipped: "not an adoption event" });
  }

  const resolved = await resolve(supabase, kind, payload.record);
  if (!resolved) return json({ skipped: "self-action or missing target" });

  // In-app notification row is created by DB triggers.
  // This function only handles push delivery.

  if (resolved.kind === "habit_adopted") {
    const { data: tokens } = await supabase
      .from("expo_push_tokens")
      .select("token")
      .eq("user_id", resolved.recipientId);
    if (!tokens?.length) return json({ ok: true, push: "no_tokens" });

    const { data: actor } = await supabase
      .from("profiles")
      .select("handle")
      .eq("id", resolved.actorId)
      .single();

    const { data: habit } = await supabase
      .from("habits")
      .select("title")
      .eq("id", resolved.targetId)
      .single();

    const actorName = actor?.handle ? `@${actor.handle}` : "Someone";
    const habitTitle = habit?.title ?? "your habit";
    const messages = tokens.map((t: { token: string }) => ({
      to: t.token,
      title: `${actorName} adopted your habit`,
      body: habitTitle,
      data: {
        kind: "habit_adopted",
        target_id: resolved.targetId,
        actor_id: resolved.actorId,
      },
      sound: "default",
    }));
    await sendExpoPush(messages);
    return json({ ok: true, push: "sent" });
  }

  const isLike = LIKE_KINDS.includes(resolved.kind);
  const prefColumn = isLike ? "notify_likes" : "notify_comments";

  const { data: prefs } = await supabase
    .from("profiles")
    .select(prefColumn)
    .eq("id", resolved.recipientId)
    .single();

  if (!prefs?.[prefColumn]) return json({ ok: true, push: "pref_disabled" });

  if (isLike) {
    await supabase.from("pending_like_notifications").insert({
      user_id: resolved.recipientId,
      kind: resolved.kind,
      actor_id: resolved.actorId,
      target_id: resolved.targetId,
      comment_id: resolved.commentId,
    });
    return json({ ok: true, push: "queued" });
  }

  const { data: actor } = await supabase
    .from("profiles")
    .select("handle")
    .eq("id", resolved.actorId)
    .single();

  const { data: tokens } = await supabase
    .from("expo_push_tokens")
    .select("token")
    .eq("user_id", resolved.recipientId);

  if (!tokens?.length) return json({ ok: true, push: "no_tokens" });

  const actorName = actor?.handle ? `@${actor.handle}` : "Someone";
  const title = `${actorName} commented`;
  const bodyText = resolved.body
    ? resolved.body.slice(0, 80)
    : "New comment on your post";

  const messages = tokens.map((t: { token: string }) => ({
    to: t.token,
    title,
    body: bodyText,
    data: {
      kind: resolved.kind,
      target_id: resolved.targetId,
      comment_id: resolved.commentId,
    },
    sound: "default",
  }));

  await sendExpoPush(messages);
  return json({ ok: true, push: "sent" });
});

async function resolve(
  supabase: ReturnType<typeof createClient>,
  kind: Kind,
  record: Record<string, string>,
): Promise<Resolved | null> {
  switch (kind) {
    case "completion_like": {
      const { data } = await supabase
        .from("habit_completions")
        .select("owner_id")
        .eq("id", record.completion_id)
        .single();
      if (!data || data.owner_id === record.user_id) return null;
      return {
        kind,
        recipientId: data.owner_id,
        actorId: record.user_id,
        targetId: record.completion_id,
        commentId: null,
        body: null,
      };
    }

    case "completion_comment": {
      const { data } = await supabase
        .from("habit_completions")
        .select("owner_id")
        .eq("id", record.completion_id)
        .single();
      if (!data || data.owner_id === record.author_id) return null;
      return {
        kind,
        recipientId: data.owner_id,
        actorId: record.author_id,
        targetId: record.completion_id,
        commentId: record.id,
        body: record.body,
      };
    }

    case "comment_like": {
      const { data } = await supabase
        .from("completion_comments")
        .select("author_id, completion_id")
        .eq("id", record.comment_id)
        .single();
      if (!data || data.author_id === record.user_id) return null;
      return {
        kind,
        recipientId: data.author_id,
        actorId: record.user_id,
        targetId: data.completion_id,
        commentId: record.comment_id,
        body: null,
      };
    }

    case "activity_like": {
      const { data } = await supabase
        .from("habit_activity")
        .select("owner_id")
        .eq("id", record.activity_id)
        .single();
      if (!data || data.owner_id === record.user_id) return null;
      return {
        kind,
        recipientId: data.owner_id,
        actorId: record.user_id,
        targetId: record.activity_id,
        commentId: null,
        body: null,
      };
    }

    case "activity_comment": {
      const { data } = await supabase
        .from("habit_activity")
        .select("owner_id")
        .eq("id", record.activity_id)
        .single();
      if (!data || data.owner_id === record.author_id) return null;
      return {
        kind,
        recipientId: data.owner_id,
        actorId: record.author_id,
        targetId: record.activity_id,
        commentId: record.id,
        body: record.body,
      };
    }

    case "activity_comment_like": {
      const { data } = await supabase
        .from("activity_comments")
        .select("author_id, activity_id")
        .eq("id", record.comment_id)
        .single();
      if (!data || data.author_id === record.user_id) return null;
      return {
        kind,
        recipientId: data.author_id,
        actorId: record.user_id,
        targetId: data.activity_id,
        commentId: record.comment_id,
        body: null,
      };
    }

    case "habit_adopted": {
      if (!record.adopted_from_user_id) return null;
      if (record.owner_id === record.adopted_from_user_id) return null;
      return {
        kind,
        recipientId: record.adopted_from_user_id,
        actorId: record.owner_id,
        targetId: record.habit_id,
        commentId: null,
        body: null,
      };
    }
  }
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
      continue;
    }

    const { data } = await res.json();
    if (!data) continue;

    for (let j = 0; j < data.length; j++) {
      if (data[j]?.details?.error === "DeviceNotRegistered") {
        const token = (messages[i + j] as { to: string }).to;
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
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
