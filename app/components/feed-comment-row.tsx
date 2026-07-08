// One comment row inside the comments sheet. Avatar + handle + body, with a
// trailing heart toggle and a "N likes" tappable count.

import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { FeedAvatar } from '@/components/feed-avatar';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { Comment } from '@/lib/feed';
import { formatRelativeTime } from '@/lib/feed';
import { useTokens } from '@/hooks/use-tokens';

type Props = {
  comment: Comment;
  viewerId: string;
  completionOwnerId: string;
  now: Date;
  onToggleLike: () => void;
  onDelete: () => void;
};

export function FeedCommentRow({
  comment,
  viewerId,
  completionOwnerId,
  now,
  onToggleLike,
  onDelete,
}: Props) {
  const t = useTokens();
  const router = useRouter();
  const canDelete =
    viewerId === comment.author_id || viewerId === completionOwnerId;
  const goToUser = () => router.push(`/user/${comment.author_id}`);

  const handleLike = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggleLike();
  };

  const openLikers = () => {
    router.push(`/likers/comment/${comment.id}`);
  };

  const handleLongPress = () => {
    if (!canDelete) return;
    Alert.alert('Delete comment?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);
  };

  return (
    <Pressable onLongPress={handleLongPress} style={styles.row}>
      <FeedAvatar
        url={comment.author_avatar_url}
        handle={comment.author_handle}
        size={32}
        onPress={goToUser}
      />
      <View style={styles.body}>
        <ThemedText style={styles.text}>
          <ThemedText style={styles.author} onPress={goToUser}>
            {comment.author_handle}
          </ThemedText>
          <ThemedText style={styles.meta}>
            {' '}
            · {formatRelativeTime(comment.created_at, now)}
          </ThemedText>
          {'\n'}
          {comment.body}
        </ThemedText>
        {comment.like_count > 0 ? (
          <Pressable onPress={openLikers} hitSlop={4} style={styles.likeRow}>
            <ThemedText style={styles.likeCount}>
              {comment.like_count === 1
                ? '1 like'
                : `${comment.like_count} likes`}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
      <Pressable onPress={handleLike} hitSlop={8} style={styles.heart}>
        <IconSymbol
          name={comment.viewer_liked ? 'heart.fill' : 'heart'}
          color={comment.viewer_liked ? t.danger : t.ink52}
          size={18}
        />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  body: { flex: 1 },
  text: { fontSize: 14, lineHeight: 19 },
  author: { fontWeight: '600' },
  meta: { opacity: 0.55, fontSize: 12 },
  likeRow: { marginTop: 4 },
  likeCount: { fontSize: 12, opacity: 0.6, fontWeight: '600' },
  heart: { paddingTop: 6, paddingLeft: 6 },
});
