// Maps a feed item's kind to the right social functions, so UI callers dispatch
// once here instead of repeating completion/activity/rest ternaries (and so a
// new kind is wired in exactly one place).

import {
  deleteActivityComment,
  deleteComment,
  deleteRestComment,
  fetchActivityComments,
  fetchActivitySocial,
  fetchComments,
  fetchCompletionSocial,
  fetchRestComments,
  fetchRestSocial,
  likeActivity,
  likeActivityComment,
  likeComment,
  likeCompletion,
  likeRest,
  likeRestComment,
  postActivityComment,
  postComment,
  postRestComment,
  unlikeActivity,
  unlikeActivityComment,
  unlikeComment,
  unlikeCompletion,
  unlikeRest,
  unlikeRestComment,
  type FeedKind,
  type LikerTargetKind,
} from "@/lib/feed";

// FeedKind → the enum the likers RPC/route expects.
export function likerKindFor(kind: FeedKind): LikerTargetKind {
  if (kind === "completion") return "completion";
  if (kind === "rest") return "rest";
  return "activity";
}

export function socialFnsFor(kind: FeedKind) {
  if (kind === "rest") {
    return { fetch: fetchRestSocial, like: likeRest, unlike: unlikeRest };
  }
  if (kind === "habit_created") {
    return { fetch: fetchActivitySocial, like: likeActivity, unlike: unlikeActivity };
  }
  return { fetch: fetchCompletionSocial, like: likeCompletion, unlike: unlikeCompletion };
}

export function commentFnsFor(kind: FeedKind) {
  if (kind === "rest") {
    return {
      fetch: fetchRestComments,
      post: postRestComment,
      remove: deleteRestComment,
      like: likeRestComment,
      unlike: unlikeRestComment,
    };
  }
  if (kind === "habit_created") {
    return {
      fetch: fetchActivityComments,
      post: postActivityComment,
      remove: deleteActivityComment,
      like: likeActivityComment,
      unlike: unlikeActivityComment,
    };
  }
  return {
    fetch: fetchComments,
    post: postComment,
    remove: deleteComment,
    like: likeComment,
    unlike: unlikeComment,
  };
}
