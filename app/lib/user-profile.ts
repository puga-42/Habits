// User profile page — types, RPC-backed queries, pure helpers.
// Pure helpers are TDD'd; see __tests__/user-profile.test.ts.

import type { FeedItem } from "./feed";
import { feedItemSortKey, feedItemStreak } from "./feed";
import type { FriendProfile } from "./friends";
import type { HabitKind } from "./habits";
import { supabase } from "./supabase";

// ─── Types ─────────────────────────────────────────────────────────────────

export type FriendshipStatus =
  | "self"
  | "friend"
  | "pending_outgoing"
  | "pending_incoming"
  | "none";

export type UserProfileData = {
  id: string;
  handle: string;
  avatar_url: string | null;
  friendship_status: FriendshipStatus;
  friends_since: string | null;
  mutual_friend_count: number;
};

export type UserHabit = {
  id: string;
  lineage_id: string;
  title: string;
  icon: string | null;
  color: string | null;
  kind: HabitKind;
};

export type UserFeedCursor = { sort_key: string; id: string };

// ─── Queries (RPC-backed) ─────────────────────────────────────────────────

export async function fetchUserProfile(
  targetId: string,
  viewerId: string,
): Promise<UserProfileData | null> {
  const { data, error } = await supabase.rpc("get_user_profile_page", {
    p_target_id: targetId,
    p_viewer_id: viewerId,
  });
  if (error) throw error;
  const rows = data as unknown as UserProfileData[];
  return rows.length > 0 ? rows[0] : null;
}

export async function fetchUserHabits(
  targetId: string,
  viewerId: string,
): Promise<UserHabit[]> {
  const { data, error } = await supabase.rpc("get_user_visible_habits", {
    p_target_id: targetId,
    p_viewer_id: viewerId,
  });
  if (error) throw error;
  return (data ?? []) as UserHabit[];
}

export async function fetchUserFeedPage(
  targetId: string,
  cursor?: UserFeedCursor,
  limit = 20,
  habitLineageId?: string,
): Promise<FeedItem[]> {
  const { data, error } = await supabase.rpc("get_user_feed_page", {
    p_target_id: targetId,
    p_habit_lineage_id: habitLineageId ?? null,
    p_cursor_sort_key: cursor?.sort_key ?? null,
    p_cursor_id: cursor?.id ?? null,
    p_limit: limit,
  });
  if (error) throw error;
  return mapFeedRows(data ?? []);
}

export async function fetchMutualFriends(
  userA: string,
  userB: string,
  limit = 10,
): Promise<FriendProfile[]> {
  const { data, error } = await supabase.rpc("get_mutual_friends", {
    p_user_a: userA,
    p_user_b: userB,
    p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as FriendProfile[];
}

// ─── Pure helpers ─────────────────────────────────────────────────────────

export const userFeedSortKey = feedItemSortKey;

export function mergeUserFeedPages(
  existing: FeedItem[],
  next: FeedItem[],
): FeedItem[] {
  const byId = new Map<string, FeedItem>();
  for (const i of existing) byId.set(i.id, i);
  for (const i of next) byId.set(i.id, i);
  return [...byId.values()].sort((a, b) => {
    const ka = userFeedSortKey(a);
    const kb = userFeedSortKey(b);
    if (ka !== kb) return ka > kb ? -1 : 1;
    return a.id > b.id ? -1 : 1;
  });
}

export function filterItemsByLineage(
  items: FeedItem[],
  habits: UserHabit[],
  lineageId: string | null,
): FeedItem[] {
  if (lineageId === null) return items;
  const habitIds = new Set(
    habits.filter((h) => h.lineage_id === lineageId).map((h) => h.id),
  );
  return items.filter((i) => habitIds.has(i.habit_id));
}

export function filterItemsByDate(
  items: FeedItem[],
  date: string | null,
): FeedItem[] {
  if (date === null) return items;
  return items.filter((i) => {
    const d =
      i.occurrence_date ?? i.period_start ?? i.completed_at?.slice(0, 10);
    return d === date;
  });
}

export function habitsCompletedOnDate(
  items: FeedItem[],
  habits: UserHabit[],
  date: string,
): UserHabit[] {
  const dateItems = filterItemsByDate(items, date);
  const habitIds = new Set(dateItems.map((i) => i.habit_id));
  return habits.filter((h) => habitIds.has(h.id));
}

export function friendshipActionLabel(status: FriendshipStatus): string | null {
  switch (status) {
    case "none":
      return "Add friend";
    case "pending_outgoing":
      return "Request sent";
    case "pending_incoming":
      return "Accept";
    case "friend":
      return "Friends";
    case "self":
      return null;
  }
}

// ─── Internal ─────────────────────────────────────────────────────────────

function mapFeedRows(rows: unknown[]): FeedItem[] {
  return (rows as Array<Record<string, unknown>>).map((r) => {
    const base = {
      id: r.id as string,
      habit_id: r.habit_id as string,
      owner_id: r.owner_id as string,
      feed_kind: r.feed_kind as FeedItem["feed_kind"],
      occurrence_date: (r.occurrence_date as string) ?? null,
      period_start: (r.period_start as string) ?? null,
      completed_at: (r.completed_at as string) ?? null,
      created_at: r.created_at as string,
      note: (r.note as string) ?? null,
      visibility_override:
        (r.visibility_override as FeedItem["visibility_override"]) ?? null,
      owner_handle: (r.owner_handle ?? r.handle) as string,
      owner_avatar_url: (r.owner_avatar_url ?? r.avatar_url) as string | null,
      habit_title: (r.habit_title ?? r.title) as string,
      habit_icon: (r.habit_icon ?? r.icon) as string | null,
      habit_color: (r.habit_color ?? r.color) as string | null,
      habit_kind: (r.habit_kind ?? r.kind) as FeedItem["habit_kind"],
      attachments: Array.isArray(r.attachments) ? r.attachments : [],
      like_count: (r.like_count as number) ?? 0,
      comment_count: (r.comment_count as number) ?? 0,
      viewer_liked: (r.viewer_liked as boolean) ?? false,
      flex_position: (r.flex_position as number) ?? null,
      flex_target: (r.flex_target as number) ?? null,
      event_type: (r.event_type as FeedItem["event_type"]) ?? null,
      adopted_from_handle: (r.adopted_from_handle as string) ?? null,
      // Habit context + streak inputs. `get_user_feed_page` does not yet return
      // these, so they fall back to safe defaults (streak/count read as 0 here)
      // until that RPC is extended — see PLAN.md follow-up.
      habit_description: (r.habit_description ?? r.description ?? null) as
        | string
        | null,
      habit_lineage_id: (r.habit_lineage_id ??
        r.lineage_id ??
        r.habit_id) as string,
      completion_count: (r.completion_count as number) ?? 0,
      habit_rrule: (r.habit_rrule ?? r.rrule ?? null) as string | null,
      habit_dtstart: (r.habit_dtstart ?? r.dtstart ?? null) as string | null,
      habit_until: (r.habit_until ?? r.until ?? null) as string | null,
      habit_target_period: (r.habit_target_period ??
        r.target_period ??
        null) as FeedItem["habit_target_period"],
      completion_history: Array.isArray(r.completion_history)
        ? (r.completion_history as string[])
        : [],
      skip_history: Array.isArray(r.skip_history)
        ? (r.skip_history as string[])
        : [],
    };
    return { ...base, streak: feedItemStreak(base) };
  });
}
