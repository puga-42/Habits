// Feed — types, RPC-backed queries, mutations, Realtime, pure helpers.
// Pure helpers are TDD'd; see __tests__/feed.test.ts.
//
// The page read goes through a single Postgres RPC (`fetch_feed_page`) that
// returns fat rows with attachments and aggregate counts already joined.
// See /FEED_PLAN.md for the architectural rationale.

import { supabase } from './supabase';
import type { HabitKind, Visibility } from './habits';

// ─── Types ─────────────────────────────────────────────────────────────────

export type Attachment = {
  id: string;
  kind: 'photo' | 'video';
  storage_path: string;
  mime_type: string;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
};

export type FeedKind = 'completion' | 'habit_created';

export type LikerTargetKind = 'completion' | 'comment' | 'activity';

export type FeedItem = {
  id: string;
  habit_id: string;
  owner_id: string;
  feed_kind: FeedKind;
  occurrence_date: string | null;
  period_start: string | null;
  completed_at: string | null;
  created_at: string;
  note: string | null;
  visibility_override: Visibility | null;
  owner_handle: string;
  owner_avatar_url: string | null;
  habit_title: string;
  habit_icon: string | null;
  habit_color: string | null;
  habit_kind: HabitKind;
  attachments: Attachment[];
  like_count: number;
  comment_count: number;
  viewer_liked: boolean;
  flex_position: number | null;
  flex_target: number | null;
};

export type Comment = {
  id: string;
  completion_id: string;
  author_id: string;
  author_handle: string;
  author_avatar_url: string | null;
  body: string;
  created_at: string;
  updated_at: string;
  like_count: number;
  viewer_liked: boolean;
};

export type Liker = {
  user_id: string;
  handle: string;
  avatar_url: string | null;
  liked_at: string;
};

export type FeedCursor = { sort_key: string; id: string };
export type CommentCursor = { created_at: string; id: string };
export type LikerCursor = { liked_at: string; user_id: string };

// ─── Page reads (single RPC each) ──────────────────────────────────────────

export async function fetchFeedPage(
  cursor?: FeedCursor,
  limit = 20,
): Promise<FeedItem[]> {
  const { data, error } = await supabase.rpc('fetch_feed_page', {
    cursor_completed_at: cursor?.sort_key ?? null,
    cursor_id: cursor?.id ?? null,
    page_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as FeedItem[];
}

export async function fetchComments(
  completionId: string,
  cursor?: CommentCursor,
  limit = 50,
): Promise<Comment[]> {
  const { data, error } = await supabase.rpc('fetch_comments_page', {
    target_completion_id: completionId,
    cursor_created_at: cursor?.created_at ?? null,
    cursor_id: cursor?.id ?? null,
    page_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as Comment[];
}

export async function fetchLikers(
  target: { kind: LikerTargetKind; id: string },
  cursor?: LikerCursor,
  limit = 50,
): Promise<Liker[]> {
  const { data, error } = await supabase.rpc('fetch_likers_page', {
    target_kind: target.kind,
    target_id: target.id,
    cursor_liked_at: cursor?.liked_at ?? null,
    cursor_user_id: cursor?.user_id ?? null,
    page_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as Liker[];
}

// ─── Mutations ─────────────────────────────────────────────────────────────

export async function likeCompletion(
  completionId: string,
  viewerId: string,
): Promise<void> {
  const { error } = await supabase
    .from('completion_likes')
    .insert({ completion_id: completionId, user_id: viewerId });
  if (error && !isUniqueViolation(error)) throw error;
}

export async function unlikeCompletion(
  completionId: string,
  viewerId: string,
): Promise<void> {
  const { error } = await supabase
    .from('completion_likes')
    .delete()
    .eq('completion_id', completionId)
    .eq('user_id', viewerId);
  if (error) throw error;
}

export async function likeComment(
  commentId: string,
  viewerId: string,
): Promise<void> {
  const { error } = await supabase
    .from('comment_likes')
    .insert({ comment_id: commentId, user_id: viewerId });
  if (error && !isUniqueViolation(error)) throw error;
}

export async function unlikeComment(
  commentId: string,
  viewerId: string,
): Promise<void> {
  const { error } = await supabase
    .from('comment_likes')
    .delete()
    .eq('comment_id', commentId)
    .eq('user_id', viewerId);
  if (error) throw error;
}

export async function postComment(
  completionId: string,
  authorId: string,
  body: string,
): Promise<Comment> {
  const trimmed = body.trim();
  if (trimmed.length === 0 || trimmed.length > 500) {
    throw new Error('Comment must be 1-500 characters');
  }
  const { data, error } = await supabase
    .from('completion_comments')
    .insert({
      completion_id: completionId,
      author_id: authorId,
      body: trimmed,
    })
    .select(
      `id, completion_id, author_id, body, created_at, updated_at,
       profiles:author_id (handle, avatar_url)`,
    )
    .single();
  if (error) throw error;
  const row = data as unknown as {
    id: string;
    completion_id: string;
    author_id: string;
    body: string;
    created_at: string;
    updated_at: string;
    profiles: {
      handle: string;
      avatar_url: string | null;
    };
  };
  return {
    id: row.id,
    completion_id: row.completion_id,
    author_id: row.author_id,
    author_handle: row.profiles.handle,
    author_avatar_url: row.profiles.avatar_url,
    body: row.body,
    created_at: row.created_at,
    updated_at: row.updated_at,
    like_count: 0,
    viewer_liked: false,
  };
}

export async function deleteComment(commentId: string): Promise<void> {
  const { error } = await supabase
    .from('completion_comments')
    .delete()
    .eq('id', commentId);
  if (error) throw error;
}

// ─── Activity mutations ───────────────────────────────────────────────────

export async function likeActivity(
  activityId: string,
  viewerId: string,
): Promise<void> {
  const { error } = await supabase
    .from('activity_likes')
    .insert({ activity_id: activityId, user_id: viewerId });
  if (error && !isUniqueViolation(error)) throw error;
}

export async function unlikeActivity(
  activityId: string,
  viewerId: string,
): Promise<void> {
  const { error } = await supabase
    .from('activity_likes')
    .delete()
    .eq('activity_id', activityId)
    .eq('user_id', viewerId);
  if (error) throw error;
}

export async function fetchActivityComments(
  activityId: string,
  cursor?: CommentCursor,
  limit = 50,
): Promise<Comment[]> {
  const { data, error } = await supabase.rpc('fetch_activity_comments_page', {
    target_activity_id: activityId,
    cursor_created_at: cursor?.created_at ?? null,
    cursor_id: cursor?.id ?? null,
    page_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as Comment[];
}

export async function postActivityComment(
  activityId: string,
  authorId: string,
  body: string,
): Promise<Comment> {
  const trimmed = body.trim();
  if (trimmed.length === 0 || trimmed.length > 500) {
    throw new Error('Comment must be 1-500 characters');
  }
  const { data, error } = await supabase
    .from('activity_comments')
    .insert({
      activity_id: activityId,
      author_id: authorId,
      body: trimmed,
    })
    .select(
      `id, activity_id, author_id, body, created_at, updated_at,
       profiles:author_id (handle, avatar_url)`,
    )
    .single();
  if (error) throw error;
  const row = data as unknown as {
    id: string;
    activity_id: string;
    author_id: string;
    body: string;
    created_at: string;
    updated_at: string;
    profiles: {
      handle: string;
      avatar_url: string | null;
    };
  };
  return {
    id: row.id,
    completion_id: row.activity_id,
    author_id: row.author_id,
    author_handle: row.profiles.handle,
    author_avatar_url: row.profiles.avatar_url,
    body: row.body,
    created_at: row.created_at,
    updated_at: row.updated_at,
    like_count: 0,
    viewer_liked: false,
  };
}

export async function deleteActivityComment(
  commentId: string,
): Promise<void> {
  const { error } = await supabase
    .from('activity_comments')
    .delete()
    .eq('id', commentId);
  if (error) throw error;
}

export async function likeActivityComment(
  commentId: string,
  viewerId: string,
): Promise<void> {
  const { error } = await supabase
    .from('activity_comment_likes')
    .insert({ comment_id: commentId, user_id: viewerId });
  if (error && !isUniqueViolation(error)) throw error;
}

export async function unlikeActivityComment(
  commentId: string,
  viewerId: string,
): Promise<void> {
  const { error } = await supabase
    .from('activity_comment_likes')
    .delete()
    .eq('comment_id', commentId)
    .eq('user_id', viewerId);
  if (error) throw error;
}

// ─── Moderation ───────────────────────────────────────────────────────────

export async function reportContent(
  reporterId: string,
  target: { kind: 'completion' | 'comment'; id: string },
  reason?: string,
): Promise<void> {
  const { error } = await supabase.from('content_reports').insert({
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
    .from('muted_habits')
    .insert({ user_id: userId, habit_id: habitId });
  if (error && !isUniqueViolation(error)) throw error;
}

export async function blockUser(
  blockerId: string,
  blockedId: string,
): Promise<void> {
  const { error } = await supabase
    .from('blocks')
    .insert({ blocker_id: blockerId, blocked_id: blockedId });
  if (error && !isUniqueViolation(error)) throw error;
}

// ─── Storage ───────────────────────────────────────────────────────────────

// Batch-sign storage paths. Returns a map of path → signed URL. Paths that
// fail to sign are omitted from the map (caller can fall back to a
// placeholder).
export async function signedUrlsForPaths(
  paths: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (paths.length === 0) return out;
  const { data, error } = await supabase.storage
    .from('completion-media')
    .createSignedUrls(paths, 60 * 60); // 1 hour
  if (error) throw error;
  for (const row of data ?? []) {
    if (row.signedUrl && row.path) {
      out.set(row.path, row.signedUrl);
    }
  }
  return out;
}

// ─── Realtime ──────────────────────────────────────────────────────────────

export type RealtimeHandlers = {
  onCompletion: (event: 'INSERT' | 'UPDATE' | 'DELETE', id: string) => void;
  onActivity: (event: 'INSERT' | 'DELETE', id: string) => void;
  onLike: (event: 'INSERT' | 'DELETE', completionId: string) => void;
  onComment: (
    event: 'INSERT' | 'UPDATE' | 'DELETE',
    completionId: string,
    commentId: string,
  ) => void;
  onCommentLike: (event: 'INSERT' | 'DELETE', commentId: string) => void;
};

export function subscribeToFeed(
  handlers: RealtimeHandlers,
  channelName = 'feed',
): () => void {
  const channel = supabase
    .channel(channelName)
    .on(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'postgres_changes' as any,
      { event: '*', schema: 'public', table: 'habit_completions' },
      (payload: {
        eventType: 'INSERT' | 'UPDATE' | 'DELETE';
        new: { id?: string };
        old: { id?: string };
      }) => {
        const id =
          payload.eventType === 'DELETE' ? payload.old.id : payload.new.id;
        if (id) handlers.onCompletion(payload.eventType, id);
      },
    )
    .on(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'postgres_changes' as any,
      { event: '*', schema: 'public', table: 'habit_activity' },
      (payload: {
        eventType: 'INSERT' | 'UPDATE' | 'DELETE';
        new: { id?: string };
        old: { id?: string };
      }) => {
        const id =
          payload.eventType === 'DELETE' ? payload.old.id : payload.new.id;
        if (id && payload.eventType !== 'UPDATE') {
          handlers.onActivity(payload.eventType, id);
        }
      },
    )
    .on(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'postgres_changes' as any,
      { event: '*', schema: 'public', table: 'completion_likes' },
      (payload: {
        eventType: 'INSERT' | 'UPDATE' | 'DELETE';
        new: { completion_id?: string };
        old: { completion_id?: string };
      }) => {
        const completionId =
          payload.eventType === 'DELETE'
            ? payload.old.completion_id
            : payload.new.completion_id;
        if (completionId && payload.eventType !== 'UPDATE') {
          handlers.onLike(payload.eventType, completionId);
        }
      },
    )
    .on(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'postgres_changes' as any,
      { event: '*', schema: 'public', table: 'completion_comments' },
      (payload: {
        eventType: 'INSERT' | 'UPDATE' | 'DELETE';
        new: { id?: string; completion_id?: string };
        old: { id?: string; completion_id?: string };
      }) => {
        const record = payload.eventType === 'DELETE' ? payload.old : payload.new;
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
      'postgres_changes' as any,
      { event: '*', schema: 'public', table: 'comment_likes' },
      (payload: {
        eventType: 'INSERT' | 'UPDATE' | 'DELETE';
        new: { comment_id?: string };
        old: { comment_id?: string };
      }) => {
        const commentId =
          payload.eventType === 'DELETE'
            ? payload.old.comment_id
            : payload.new.comment_id;
        if (commentId && payload.eventType !== 'UPDATE') {
          handlers.onCommentLike(payload.eventType, commentId);
        }
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ─── Pure helpers ──────────────────────────────────────────────────────────

// Human-friendly relative time. Stable thresholds: <60s "just now"; <60m "Nm";
// <24h "Nh"; ~1 day "yesterday"; <7 days weekday short name; else "Mon D".
export function formatRelativeTime(timestampIso: string, now: Date): string {
  const then = new Date(timestampIso).getTime();
  const diffMs = now.getTime() - then;
  const sec = Math.max(0, Math.floor(diffMs / 1000));
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day === 1) return 'yesterday';
  if (day < 7) {
    return new Date(then).toLocaleDateString('en-US', { weekday: 'short' });
  }
  return new Date(then).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function feedItemSortKey(item: FeedItem): string {
  return item.feed_kind === 'completion'
    ? (item.completed_at ?? item.created_at)
    : item.created_at;
}

export function mergeFeedPages(
  existing: FeedItem[],
  next: FeedItem[],
): FeedItem[] {
  const byId = new Map<string, FeedItem>();
  for (const item of existing) byId.set(item.id, item);
  for (const item of next) byId.set(item.id, item);
  return [...byId.values()].sort((a, b) => {
    const aKey = feedItemSortKey(a);
    const bKey = feedItemSortKey(b);
    if (aKey !== bKey) return aKey < bKey ? 1 : -1;
    return a.id < b.id ? 1 : -1;
  });
}

// Apply an optimistic like toggle to a feed item. Idempotent; never drives
// like_count below zero.
export function applyLikeToggle(item: FeedItem, liked: boolean): FeedItem {
  if (item.viewer_liked === liked) return item;
  return {
    ...item,
    viewer_liked: liked,
    like_count: liked
      ? item.like_count + 1
      : Math.max(0, item.like_count - 1),
  };
}

export function applyCommentLikeToggle(
  comment: Comment,
  liked: boolean,
): Comment {
  if (comment.viewer_liked === liked) return comment;
  return {
    ...comment,
    viewer_liked: liked,
    like_count: liked
      ? comment.like_count + 1
      : Math.max(0, comment.like_count - 1),
  };
}

export function parseLikerKind(raw: string): LikerTargetKind {
  if (raw === 'completion' || raw === 'comment' || raw === 'activity') return raw;
  return 'completion';
}

// Postgres unique-violation SQLSTATE.
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === '23505'
  );
}
