// Feed — the public entry point for the feed domain.
//
// Implementation is split across focused modules (feed-types, feed-helpers, and
// the per-kind social modules feed-completion / feed-activity / feed-rest, plus
// feed-realtime). This file keeps the cross-kind page reads, likers, storage,
// and moderation, and re-exports the rest so `@/lib/feed` stays the one import
// surface. See /FEED_PLAN.md for the architectural rationale.

import { supabase } from "./supabase";
import { feedItemStreak, isUniqueViolation } from "./feed-helpers";
import type {
  FeedCursor,
  FeedItem,
  Liker,
  LikerCursor,
  LikerTargetKind,
} from "./feed-types";

export * from "./feed-types";
export * from "./feed-helpers";
export * from "./feed-completion";
export * from "./feed-activity";
export * from "./feed-rest";
export * from "./feed-realtime";

// ─── Page reads (single RPC each) ──────────────────────────────────────────

export async function fetchFeedPage(
  cursor?: FeedCursor,
  limit = 20,
): Promise<FeedItem[]> {
  const { data, error } = await supabase.rpc("fetch_feed_page", {
    cursor_completed_at: cursor?.sort_key ?? null,
    cursor_id: cursor?.id ?? null,
    page_limit: limit,
  });
  if (error) throw error;
  const rows = (data ?? []) as Omit<FeedItem, "streak">[];
  return rows.map((row) => ({ ...row, streak: feedItemStreak(row) }));
}

export async function fetchLikers(
  target: { kind: LikerTargetKind; id: string },
  cursor?: LikerCursor,
  limit = 50,
): Promise<Liker[]> {
  const { data, error } = await supabase.rpc("fetch_likers_page", {
    target_kind: target.kind,
    target_id: target.id,
    cursor_liked_at: cursor?.liked_at ?? null,
    cursor_user_id: cursor?.user_id ?? null,
    page_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as Liker[];
}

// ─── Storage ───────────────────────────────────────────────────────────────

// Batch-sign storage paths. Returns a map of path → signed URL. Paths that fail
// to sign are omitted from the map (caller can fall back to a placeholder).
export async function signedUrlsForPaths(
  paths: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (paths.length === 0) return out;
  const { data, error } = await supabase.storage
    .from("completion-media")
    .createSignedUrls(paths, 60 * 60); // 1 hour
  if (error) throw error;
  for (const row of data ?? []) {
    if (row.signedUrl && row.path) {
      out.set(row.path, row.signedUrl);
    }
  }
  return out;
}

// ─── Moderation ───────────────────────────────────────────────────────────

export async function reportContent(
  reporterId: string,
  target: { kind: "completion" | "comment"; id: string },
  reason?: string,
): Promise<void> {
  const { error } = await supabase.from("content_reports").insert({
    reporter_id: reporterId,
    target_kind: target.kind,
    target_id: target.id,
    reason: reason ?? null,
  });
  if (error) throw error;
}

export async function muteHabit(
  userId: string,
  habitId: string,
): Promise<void> {
  const { error } = await supabase
    .from("muted_habits")
    .insert({ user_id: userId, habit_id: habitId });
  if (error && !isUniqueViolation(error)) throw error;
}

export async function blockUser(
  blockerId: string,
  blockedId: string,
): Promise<void> {
  const { error } = await supabase
    .from("blocks")
    .insert({ blocker_id: blockerId, blocked_id: blockedId });
  if (error && !isUniqueViolation(error)) throw error;
}
