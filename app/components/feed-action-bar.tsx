// Action bar under a feed card: heart toggle + comment button. No share
// button (decided out of scope for v1). The "N likes" line below the row is
// tappable and opens the likers screen.

import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { FeedKind } from '@/lib/feed';

type Props = {
  targetId: string;
  targetKind: FeedKind;
  likeCount: number;
  commentCount: number;
  viewerLiked: boolean;
  onToggleLike: () => void;
  onOpenComments: () => void;
};

export function FeedActionBar({
  targetId,
  targetKind,
  likeCount,
  commentCount,
  viewerLiked,
  onToggleLike,
  onOpenComments,
}: Props) {
  const router = useRouter();

  const handleLike = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggleLike();
  };

  const likersKind = targetKind === 'completion' ? 'completion' : 'activity';
  const openLikers = () => {
    router.push(`/likers/${likersKind}/${targetId}`);
  };

  return (
    <View>
      {likeCount > 0 ? (
        <Pressable onPress={openLikers} hitSlop={4} style={styles.countRow}>
          <ThemedText style={styles.countLine}>
            {likeCount === 1 ? '1 like' : `${likeCount} likes`}
          </ThemedText>
          <ThemedText style={styles.chev}> ›</ThemedText>
        </Pressable>
      ) : null}

      <View style={styles.row}>
        <Pressable onPress={handleLike} hitSlop={8} style={styles.iconButton}>
          <IconSymbol
            name={viewerLiked ? 'heart.fill' : 'heart'}
            color={viewerLiked ? '#ff3b5c' : 'rgba(127,127,127,0.9)'}
            size={26}
          />
        </Pressable>
        <Pressable onPress={onOpenComments} hitSlop={8} style={styles.commentButton}>
          <IconSymbol name="bubble.right" color="rgba(127,127,127,0.9)" size={24} />
          {commentCount > 0 ? (
            <ThemedText style={styles.commentCount}>{commentCount}</ThemedText>
          ) : null}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 6,
  },
  iconButton: { padding: 4 },
  commentButton: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4 },
  commentCount: { fontSize: 14, opacity: 0.7 },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  countLine: { fontSize: 14, fontWeight: '600' },
  chev: { fontSize: 14, opacity: 0.55 },
});
