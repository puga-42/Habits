// Feed realtime — postgres_changes subscriptions for live updates.

import { supabase } from "./supabase";
import { uniqueChannelName } from "./realtime-channel-name";

// ─── Realtime ──────────────────────────────────────────────────────────────

export type RealtimeHandlers = {
  onCompletion: (event: "INSERT" | "UPDATE" | "DELETE", id: string) => void;
  onActivity: (event: "INSERT" | "DELETE", id: string) => void;
  onLike: (event: "INSERT" | "DELETE", completionId: string) => void;
  onComment: (
    event: "INSERT" | "UPDATE" | "DELETE",
    completionId: string,
    commentId: string,
  ) => void;
  onCommentLike: (event: "INSERT" | "DELETE", commentId: string) => void;
  // Rest posts mirror completions; handlers are optional so callers that don't
  // care about rests (or predate them) don't have to provide no-ops.
  onRest?: (event: "INSERT" | "DELETE", id: string) => void;
  onRestLike?: (event: "INSERT" | "DELETE", restId: string) => void;
  onRestComment?: (
    event: "INSERT" | "UPDATE" | "DELETE",
    restId: string,
    commentId: string,
  ) => void;
  onRestCommentLike?: (event: "INSERT" | "DELETE", commentId: string) => void;
};

export function subscribeToFeed(
  handlers: RealtimeHandlers,
  channelName = "feed",
): () => void {
  const channel = supabase
    .channel(uniqueChannelName(channelName))
    .on(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      "postgres_changes" as any,
      { event: "*", schema: "public", table: "habit_completions" },
      (payload: {
        eventType: "INSERT" | "UPDATE" | "DELETE";
        new: { id?: string };
        old: { id?: string };
      }) => {
        const id =
          payload.eventType === "DELETE" ? payload.old.id : payload.new.id;
        if (id) handlers.onCompletion(payload.eventType, id);
      },
    )
    .on(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      "postgres_changes" as any,
      { event: "*", schema: "public", table: "habit_activity" },
      (payload: {
        eventType: "INSERT" | "UPDATE" | "DELETE";
        new: { id?: string };
        old: { id?: string };
      }) => {
        const id =
          payload.eventType === "DELETE" ? payload.old.id : payload.new.id;
        if (id && payload.eventType !== "UPDATE") {
          handlers.onActivity(payload.eventType, id);
        }
      },
    )
    .on(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      "postgres_changes" as any,
      { event: "*", schema: "public", table: "completion_likes" },
      (payload: {
        eventType: "INSERT" | "UPDATE" | "DELETE";
        new: { completion_id?: string };
        old: { completion_id?: string };
      }) => {
        const completionId =
          payload.eventType === "DELETE"
            ? payload.old.completion_id
            : payload.new.completion_id;
        if (completionId && payload.eventType !== "UPDATE") {
          handlers.onLike(payload.eventType, completionId);
        }
      },
    )
    .on(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      "postgres_changes" as any,
      { event: "*", schema: "public", table: "completion_comments" },
      (payload: {
        eventType: "INSERT" | "UPDATE" | "DELETE";
        new: { id?: string; completion_id?: string };
        old: { id?: string; completion_id?: string };
      }) => {
        const record =
          payload.eventType === "DELETE" ? payload.old : payload.new;
        if (record.id && record.completion_id) {
          handlers.onComment(
            payload.eventType,
            record.completion_id,
            record.id,
          );
        }
      },
    )
    .on(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      "postgres_changes" as any,
      { event: "*", schema: "public", table: "comment_likes" },
      (payload: {
        eventType: "INSERT" | "UPDATE" | "DELETE";
        new: { comment_id?: string };
        old: { comment_id?: string };
      }) => {
        const commentId =
          payload.eventType === "DELETE"
            ? payload.old.comment_id
            : payload.new.comment_id;
        if (commentId && payload.eventType !== "UPDATE") {
          handlers.onCommentLike(payload.eventType, commentId);
        }
      },
    )
    .on(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      "postgres_changes" as any,
      { event: "*", schema: "public", table: "habit_rests" },
      (payload: {
        eventType: "INSERT" | "UPDATE" | "DELETE";
        new: { id?: string };
        old: { id?: string };
      }) => {
        const id =
          payload.eventType === "DELETE" ? payload.old.id : payload.new.id;
        if (id && payload.eventType !== "UPDATE") {
          handlers.onRest?.(payload.eventType, id);
        }
      },
    )
    .on(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      "postgres_changes" as any,
      { event: "*", schema: "public", table: "rest_likes" },
      (payload: {
        eventType: "INSERT" | "UPDATE" | "DELETE";
        new: { rest_id?: string };
        old: { rest_id?: string };
      }) => {
        const restId =
          payload.eventType === "DELETE"
            ? payload.old.rest_id
            : payload.new.rest_id;
        if (restId && payload.eventType !== "UPDATE") {
          handlers.onRestLike?.(payload.eventType, restId);
        }
      },
    )
    .on(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      "postgres_changes" as any,
      { event: "*", schema: "public", table: "rest_comments" },
      (payload: {
        eventType: "INSERT" | "UPDATE" | "DELETE";
        new: { id?: string; rest_id?: string };
        old: { id?: string; rest_id?: string };
      }) => {
        const record =
          payload.eventType === "DELETE" ? payload.old : payload.new;
        if (record.id && record.rest_id) {
          handlers.onRestComment?.(payload.eventType, record.rest_id, record.id);
        }
      },
    )
    .on(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      "postgres_changes" as any,
      { event: "*", schema: "public", table: "rest_comment_likes" },
      (payload: {
        eventType: "INSERT" | "UPDATE" | "DELETE";
        new: { comment_id?: string };
        old: { comment_id?: string };
      }) => {
        const commentId =
          payload.eventType === "DELETE"
            ? payload.old.comment_id
            : payload.new.comment_id;
        if (commentId && payload.eventType !== "UPDATE") {
          handlers.onRestCommentLike?.(payload.eventType, commentId);
        }
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
