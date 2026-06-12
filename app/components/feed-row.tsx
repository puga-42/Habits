// One feed row: dispatches to FeedCard (a completion) or FeedActivityCard (a
// "started/adopted habit" event). Memoized so a realtime tick that re-renders
// the feed screen only updates the rows whose `item` actually changed.
//
// The screen passes item-taking callbacks that are referentially stable across
// renders (useCallback). The per-item zero-arg closures the cards expect are
// built here instead, so they're recreated only when this row itself
// re-renders — i.e. only when its `item` changes.

import { memo } from "react";

import { FeedActivityCard } from "@/components/feed-activity-card";
import { FeedCard } from "@/components/feed-card";
import type { FeedItem } from "@/lib/feed";

type Props = {
  item: FeedItem;
  viewerId: string;
  now: Date;
  onToggleLike: (item: FeedItem) => void;
  onOpenComments: (item: FeedItem) => void;
  onEditCompletion: (item: FeedItem) => void;
  onHabitPress: (item: FeedItem) => void;
  onReport: (item: FeedItem) => void;
  onBlock: (item: FeedItem) => void;
  onMute: (item: FeedItem) => void;
};

export const FeedRow = memo(function FeedRow({
  item,
  viewerId,
  now,
  onToggleLike,
  onOpenComments,
  onEditCompletion,
  onHabitPress,
  onReport,
  onBlock,
  onMute,
}: Props) {
  if (item.feed_kind === "habit_created") {
    return (
      <FeedActivityCard
        item={item}
        viewerId={viewerId}
        now={now}
        onToggleLike={() => onToggleLike(item)}
        onOpenComments={() => onOpenComments(item)}
        onHabitPress={() => onHabitPress(item)}
        onReport={() => onReport(item)}
        onBlock={() => onBlock(item)}
        onMute={() => onMute(item)}
      />
    );
  }

  return (
    <FeedCard
      item={item}
      viewerId={viewerId}
      now={now}
      onToggleLike={() => onToggleLike(item)}
      onOpenComments={() => onOpenComments(item)}
      onEdit={
        item.owner_id === viewerId ? () => onEditCompletion(item) : undefined
      }
      onHabitPress={() => onHabitPress(item)}
      onReport={() => onReport(item)}
      onBlock={() => onBlock(item)}
      onMute={() => onMute(item)}
    />
  );
});
