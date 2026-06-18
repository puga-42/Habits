// Feed pure helpers — TDD'd in __tests__/feed.test.ts. No I/O here.

import { computeStreak, type ScheduleSegment } from "./streak";
import type {
  Comment,
  FeedItem,
  LikerTargetKind,
  SocialCounts,
} from "./feed-types";

// Human-friendly relative time. Stable thresholds: <60s "just now"; <60m "Nm";
// <24h "Nh"; ~1 day "yesterday"; <7 days weekday short name; else "Mon D".
export function formatRelativeTime(timestampIso: string, now: Date): string {
  const then = new Date(timestampIso).getTime();
  const diffMs = now.getTime() - then;
  const sec = Math.max(0, Math.floor(diffMs / 1000));
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "yesterday";
  if (day < 7) {
    return new Date(then).toLocaleDateString("en-US", { weekday: "short" });
  }
  return new Date(then).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// The streak-relevant subset of a feed row. Kept structural so this works on a
// FeedItem or a row that doesn't have `streak` attached yet (the fetch paths
// build the streak from these fields).
type StreakFields = Pick<
  FeedItem,
  | "feed_kind"
  | "habit_kind"
  | "habit_rrule"
  | "habit_dtstart"
  | "habit_until"
  | "flex_target"
  | "habit_target_period"
  | "habit_segments"
  | "occurrence_date"
  | "period_start"
  | "completion_history"
  | "skip_history"
>;

// Streak for a feed row, computed *as of that completion's own date* — not the
// current date. A feed card is a permanent record of one completion, so the
// 6/11 card must keep showing "2" even after the streak later grows to 3. We
// reuse the shared, cadence-aware computeStreak (so the feed and habit screens
// never disagree) but anchor its "now" to the item's occurrence_date (scheduled)
// / period_start (flex): computeStreak excludes occurrences after that anchor,
// so the same lineage history yields the right number per card. Activity
// (habit_created) rows have no completion of their own, so their streak is 0.
//
// Note: completion_history is capped at the most recent ~100 dates, so a card
// older than the viewer's 100 most recent completions of this habit may
// under-report — the same pre-existing cap the live streak already carries.
export function feedItemStreak(item: StreakFields): number {
  if (item.feed_kind !== "completion") return 0;
  const anchorIso = item.occurrence_date ?? item.period_start;
  if (!anchorIso) return 0;
  const segments: ScheduleSegment[] =
    item.habit_segments && item.habit_segments.length > 0
      ? item.habit_segments
      : [
          {
            rrule: item.habit_rrule,
            dtstart: item.habit_dtstart,
            until: item.habit_until,
            target_count: item.flex_target,
            target_period: item.habit_target_period,
          },
        ];
  return computeStreak(
    {
      kind: item.habit_kind,
      segments,
      completion_dates: item.completion_history,
      skip_dates: item.skip_history,
    },
    parseLocalDate(anchorIso),
  );
}

// Parse a YYYY-MM-DD date as local noon, avoiding the UTC-midnight rollback that
// `new Date('YYYY-MM-DD')` causes in negative-offset timezones. Noon keeps
// computeStreak's local-day math (isoDate/endOfLocalDay) on the intended day.
function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d, 12, 0, 0);
}

export function feedItemSortKey(item: FeedItem): string {
  return item.feed_kind === "completion"
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
    like_count: liked ? item.like_count + 1 : Math.max(0, item.like_count - 1),
  };
}

// Optimistic like toggle for a target's social counts. Idempotent; never drives
// like_count below zero; leaves comment_count untouched.
export function toggleSocialLike(
  social: SocialCounts,
  liked: boolean,
): SocialCounts {
  if (social.viewer_liked === liked) return social;
  return {
    ...social,
    viewer_liked: liked,
    like_count: liked
      ? social.like_count + 1
      : Math.max(0, social.like_count - 1),
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
  if (
    raw === "completion" ||
    raw === "comment" ||
    raw === "activity" ||
    raw === "rest"
  )
    return raw;
  return "completion";
}

// Postgres unique-violation SQLSTATE.
export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "23505"
  );
}
