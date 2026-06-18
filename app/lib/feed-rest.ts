// Rest feed social — rests are likeable + commentable like completions.

import { supabase } from "./supabase";
import type { Comment, CommentCursor, SocialCounts } from "./feed-types";
import { isUniqueViolation } from "./feed-helpers";

// ─── Rest social ──────────────────────────────────────────────────────────
//
// Rest posts are likeable and commentable exactly like completions. The Comment
// type's `completion_id` field doubles as the generic parent id (as it already
// does for activity comments).

export async function fetchRestSocial(
  restId: string,
  viewerId: string,
): Promise<SocialCounts> {
  const [likes, comments, mine] = await Promise.all([
    supabase
      .from("rest_likes")
      .select("*", { count: "exact", head: true })
      .eq("rest_id", restId),
    supabase
      .from("rest_comments")
      .select("*", { count: "exact", head: true })
      .eq("rest_id", restId),
    supabase
      .from("rest_likes")
      .select("user_id")
      .eq("rest_id", restId)
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

export async function likeRest(restId: string, viewerId: string): Promise<void> {
  const { error } = await supabase
    .from("rest_likes")
    .insert({ rest_id: restId, user_id: viewerId });
  if (error && !isUniqueViolation(error)) throw error;
}

export async function unlikeRest(
  restId: string,
  viewerId: string,
): Promise<void> {
  const { error } = await supabase
    .from("rest_likes")
    .delete()
    .eq("rest_id", restId)
    .eq("user_id", viewerId);
  if (error) throw error;
}

export async function fetchRestComments(
  restId: string,
  cursor?: CommentCursor,
  limit = 50,
): Promise<Comment[]> {
  const { data, error } = await supabase.rpc("fetch_rest_comments_page", {
    target_rest_id: restId,
    cursor_created_at: cursor?.created_at ?? null,
    cursor_id: cursor?.id ?? null,
    page_limit: limit,
  });
  if (error) throw error;
  // The RPC returns `rest_id`; map it onto the Comment.completion_id parent slot.
  return ((data ?? []) as (Omit<Comment, "completion_id"> & { rest_id: string })[]).map(
    ({ rest_id, ...rest }) => ({ ...rest, completion_id: rest_id }),
  );
}

export async function postRestComment(
  restId: string,
  authorId: string,
  body: string,
): Promise<Comment> {
  const trimmed = body.trim();
  if (trimmed.length === 0 || trimmed.length > 500) {
    throw new Error("Comment must be 1-500 characters");
  }
  const { data, error } = await supabase
    .from("rest_comments")
    .insert({ rest_id: restId, author_id: authorId, body: trimmed })
    .select(
      `id, rest_id, author_id, body, created_at, updated_at,
       profiles:author_id (handle, avatar_url)`,
    )
    .single();
  if (error) throw error;
  const row = data as unknown as {
    id: string;
    rest_id: string;
    author_id: string;
    body: string;
    created_at: string;
    updated_at: string;
    profiles: { handle: string; avatar_url: string | null };
  };
  return {
    id: row.id,
    completion_id: row.rest_id,
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

export async function deleteRestComment(commentId: string): Promise<void> {
  const { error } = await supabase
    .from("rest_comments")
    .delete()
    .eq("id", commentId);
  if (error) throw error;
}

export async function likeRestComment(
  commentId: string,
  viewerId: string,
): Promise<void> {
  const { error } = await supabase
    .from("rest_comment_likes")
    .insert({ comment_id: commentId, user_id: viewerId });
  if (error && !isUniqueViolation(error)) throw error;
}

export async function unlikeRestComment(
  commentId: string,
  viewerId: string,
): Promise<void> {
  const { error } = await supabase
    .from("rest_comment_likes")
    .delete()
    .eq("comment_id", commentId)
    .eq("user_id", viewerId);
  if (error) throw error;
}
