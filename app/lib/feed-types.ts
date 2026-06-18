// Feed domain types — shared across the feed modules.

import type { FlexPeriod, HabitKind, Visibility } from "./habits";
import type { ScheduleSegment } from "./streak";

export type Attachment = {
  id: string;
  kind: "photo" | "video";
  storage_path: string;
  mime_type: string;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
};

export type FeedKind = "completion" | "habit_created" | "rest";

export type LikerTargetKind = "completion" | "comment" | "activity" | "rest";

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
  event_type: "created" | "adopted" | null;
  adopted_from_handle: string | null;
  // Habit context (for the card body + streak). All lineage-scoped.
  habit_description: string | null;
  habit_lineage_id: string;
  completion_count: number;
  // Streak inputs — see lib/streak.ts. completion_history / skip_history are
  // the most recent ~100 dates (YYYY-MM-DD), newest first. habit_segments is one
  // entry per lineage row (oldest first) so the streak spans schedule edits; the
  // flat habit_rrule/dtstart/until/target_period below are the active row, kept
  // as a fallback for clients/RPCs that predate segments.
  habit_rrule: string | null;
  habit_dtstart: string | null;
  habit_until: string | null;
  habit_target_period: FlexPeriod | null;
  habit_segments?: ScheduleSegment[];
  completion_history: string[];
  skip_history: string[];
  // Current streak, derived from the history above via lib/streak.ts. Computed
  // once per page in fetchFeedPage so cards never expand RRULEs while rendering
  // or scrolling. 0 for activity (habit_created) items.
  streak: number;
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

// Social counts (likes/comments) for a single feed target — a completion or a
// "started habit" activity. The feed gets these from `fetch_feed_page`; screens
// keyed by habit (e.g. the habit overview) fetch them on demand.
export type SocialCounts = {
  like_count: number;
  comment_count: number;
  viewer_liked: boolean;
};

export type FeedCursor = { sort_key: string; id: string };
export type CommentCursor = { created_at: string; id: string };
export type LikerCursor = { liked_at: string; user_id: string };
