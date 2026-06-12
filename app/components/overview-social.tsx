// Likes + like/comment bar for the overview's active social target — a
// completion or a "started habit" activity — plus the comments bottom sheet it
// opens. Mirrors the feed's social surface (FeedActionBar renders both the
// "N likes → likers" row and the buttons).

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { FeedActionBar } from '@/components/feed-action-bar';
import { FeedCommentsSheet } from '@/components/feed-comments-sheet';
import type { FeedKind, SocialCounts } from '@/lib/feed';

type Props = {
  targetKind: FeedKind;
  targetId: string;
  targetOwnerId: string;
  social: SocialCounts;
  onToggleLike: () => void;
  onCommentCountChange: (delta: number) => void;
};

export function OverviewSocial({
  targetKind,
  targetId,
  targetOwnerId,
  social,
  onToggleLike,
  onCommentCountChange,
}: Props) {
  const [commentsOpen, setCommentsOpen] = useState(false);

  return (
    <View style={styles.wrap}>
      <FeedActionBar
        targetId={targetId}
        targetKind={targetKind}
        likeCount={social.like_count}
        commentCount={social.comment_count}
        viewerLiked={social.viewer_liked}
        onToggleLike={onToggleLike}
        onOpenComments={() => setCommentsOpen(true)}
      />
      <FeedCommentsSheet
        visible={commentsOpen}
        targetId={targetId}
        targetKind={targetKind}
        targetOwnerId={targetOwnerId}
        onClose={() => setCommentsOpen(false)}
        onCountChange={onCommentCountChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(127,127,127,0.2)',
    paddingTop: 12,
  },
});
