// Completion feed social: comments + likes on a completion post.

import { supabase } from "./supabase";
import type { Comment, CommentCursor, SocialCounts } from "./feed-types";
import { isUniqueViolation } from "./feed-helpers";

export async function fetchComments(
  completionId: string,
  cursor?: CommentCursor,
  limit = 50,
): Promise<Comment[]> {
  const { data, error } = await supabase.rpc("fetch_comments_page", {
    target_completion_id: completionId,
    cursor_created_at: cursor?.created_at ?? null,
    cursor_id: cursor?.id ?? null,
    page_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as Comment[];
}

// Like/comment counts + viewer-liked for one completion. RLS scopes the rows
// to what the viewer may read, so head counts and the viewer check are safe.
export async function fetchCompletionSocial(
  completionId: string,
  viewerId: string,
): Promise<SocialCounts> {
  const [likes, comments, mine] = await Promise.all([
    supabase
      .from("completion_likes")
      .select("*", { count: "exact", head: true })
      .eq("completion_id", completionId),
    supabase
      .from("completion_comments")
      .select("*", { count: "exact", head: true })
      .eq("completion_id", completionId),
    supabase
      .from("completion_likes")
      .select("user_id")
      .eq("completion_id", completionId)
      .eq("user_id", viewerId)
      .maybeSingle(),
  ]);
  if (likes.error) throw likes.error;
  if (comments.error) throw comments.error;
  if (mine.error) throw mine.error;
  return {
    like_count: likes.count ?? 0,
    comment_count: comments.count ?? 0,
    viewer_liked: mine.data != null,
  };
}

// ─── Mutations ─────────────────────────────────────────────────────────────

export async function likeCompletion(
  completionId: string,
  viewerId: string,
): Promise<void> {
  const { error } = await supabase
    .from("completion_likes")
    .insert({ completion_id: completionId, user_id: viewerId });
  if (error && !isUniqueViolation(error)) throw error;
}

export async function unlikeCompletion(
  completionId: string,
  viewerId: string,
): Promise<void> {
  const { error } = await supabase
    .from("completion_likes")
    .delete()
    .eq("completion_id", completionId)
    .eq("user_id", viewerId);
  if (error) throw error;
}

export async function likeComment(
  commentId: string,
  viewerId: string,
): Promise<void> {
  const { error } = await supabase
    .from("comment_likes")
    .insert({ comment_id: commentId, user_id: viewerId });
  if (error && !isUniqueViolation(error)) throw error;
}

export async function unlikeComment(
  commentId: string,
  viewerId: string,
): Promise<void> {
  const { error } = await supabase
    .from("comment_likes")
    .delete()
    .eq("comment_id", commentId)
    .eq("user_id", viewerId);
  if (error) throw error;
}

export async function postComment(
  completionId: string,
  authorId: string,
  body: string,
): Promise<Comment> {
  const trimmed = body.trim();
  if (trimmed.length === 0 || trimmed.length > 500) {
    throw new Error("Comment must be 1-500 characters");
  }
  const { data, error } = await supabase
    .from("completion_comments")
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
    .from("completion_comments")
    .delete()
    .eq("id", commentId);
  if (error) throw error;
}
