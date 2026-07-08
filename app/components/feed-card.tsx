// One feed card. Header (avatar + handle + relative time + overflow menu),
// the habit line ("completed Meditate 🧘"), optional attachment carousel,
// optional note excerpt, action bar.

import { useRouter } from 'expo-router';
import { memo } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { FeedActionBar } from '@/components/feed-action-bar';
import { FeedAttachmentCarousel } from '@/components/feed-attachment-carousel';
import { FeedAvatar } from '@/components/feed-avatar';
import { FeedCardStats } from '@/components/feed-card-stats';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { FeedItem } from '@/lib/feed';
import { feedItemSortKey, formatRelativeTime } from '@/lib/feed';
import { useTokens } from '@/hooks/use-tokens';

type Props = {
  item: FeedItem;
  viewerId: string;
  now: Date;
  onToggleLike: () => void;
  onOpenComments: () => void;
  onEdit?: () => void;
  onHabitPress: () => void;
  onReport: () => void;
  onBlock: () => void;
  onMute: () => void;
};

// Memoized: the feed re-renders on every realtime like/comment tick, but a card
// only needs to update when its own `item` (or a callback) actually changes.
// The parent (feed-row.tsx) keeps these props referentially stable per item.
export const FeedCard = memo(function FeedCard({
  item,
  viewerId,
  now,
  onToggleLike,
  onOpenComments,
  onEdit,
  onHabitPress,
  onReport,
  onBlock,
  onMute,
}: Props) {
  const router = useRouter();
  const isSelf = item.owner_id === viewerId;
  const goToUser = () => router.push(`/user/${item.owner_id}`);

  const openOverflow = () => {
    const buttons: { text: string; onPress?: () => void; style?: 'destructive' | 'cancel' }[] = [];
    if (!isSelf) {
      buttons.push({ text: 'Report content', onPress: onReport });
      buttons.push({ text: 'Block user', onPress: onBlock, style: 'destructive' });
    }
    buttons.push({ text: 'Mute this habit', onPress: onMute });
    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Options', undefined, buttons, { cancelable: true });
  };

  const t = useTokens();
  const fallbackColor = item.habit_color ?? t.ink45;

  return (
    <Pressable style={styles.card} onPress={onHabitPress}>
      <View style={styles.header}>
        <FeedAvatar
          url={item.owner_avatar_url}
          handle={item.owner_handle}
          size={36}
          tintColor={fallbackColor}
          onPress={goToUser}
        />
        <View style={styles.headerText}>
          <Pressable onPress={goToUser}>
            <ThemedText style={styles.handle} numberOfLines={1}>
              @{item.owner_handle}
            </ThemedText>
          </Pressable>
          <ThemedText style={styles.meta} numberOfLines={1}>
            {formatRelativeTime(feedItemSortKey(item), now)}
          </ThemedText>
        </View>
        {isSelf && onEdit && (
          <Pressable onPress={onEdit} hitSlop={10} style={styles.menuButton}>
            <IconSymbol name="pencil" color={t.ink70} size={18} />
          </Pressable>
        )}
        <Pressable onPress={openOverflow} hitSlop={10} style={styles.menuButton}>
          <IconSymbol name="ellipsis" color={t.ink70} size={22} />
        </Pressable>
      </View>

      <View style={styles.body}>
        <View style={styles.bodyMain}>
          <View style={styles.habitLine}>
            <ThemedText style={styles.habitVerb}>
              {item.feed_kind === 'rest' ? 'is resting ' : 'completed '}
            </ThemedText>
            <ThemedText style={styles.habitTitle}>{item.habit_title}</ThemedText>
            {item.habit_icon ? (
              <ThemedText style={styles.habitIcon}> {item.habit_icon}</ThemedText>
            ) : null}
            {item.flex_position != null && item.flex_target != null && (
              <ThemedText style={styles.flexProgress}>
                {' '}{item.flex_position}/{item.flex_target}
              </ThemedText>
            )}
          </View>
          {item.habit_description ? (
            <ThemedText style={styles.description} numberOfLines={5}>
              {item.habit_description}
            </ThemedText>
          ) : null}
        </View>
        <FeedCardStats streak={item.streak} />
      </View>

      {item.attachments.length > 0 ? (
        <View style={styles.attachmentWrap}>
          <FeedAttachmentCarousel attachments={item.attachments} />
        </View>
      ) : null}

      {item.note ? (
        <View style={styles.noteWrap}>
          <ThemedText style={styles.note} numberOfLines={2}>
            {item.note}
          </ThemedText>
        </View>
      ) : null}

      <View style={styles.actionWrap}>
        <FeedActionBar
          targetId={item.id}
          targetKind={item.feed_kind}
          likeCount={item.like_count}
          commentCount={item.comment_count}
          viewerLiked={item.viewer_liked}
          onToggleLike={onToggleLike}
          onOpenComments={onOpenComments}
        />
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: { paddingTop: 12, paddingBottom: 18 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
  },
  headerText: { flex: 1 },
  handle: { fontSize: 15, fontWeight: '600' },
  meta: { fontSize: 12, opacity: 0.55, marginTop: 1 },
  menuButton: { padding: 4 },
  // Two columns above the media: text on the left, stats under the ••• menu on
  // the right, top-aligned so the stats sit level with the title.
  body: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    marginTop: 6,
    marginBottom: 10,
    gap: 8,
  },
  bodyMain: { flex: 1 },
  habitLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
  },
  habitVerb: { fontSize: 14, opacity: 0.7 },
  habitTitle: { fontSize: 15, fontWeight: '600' },
  habitIcon: { fontSize: 16 },
  flexProgress: { fontSize: 13, opacity: 0.5, fontWeight: '500' },
  description: { fontSize: 14, lineHeight: 19, opacity: 0.7, marginTop: 4 },
  attachmentWrap: { marginBottom: 4 },
  actionWrap: { paddingHorizontal: 14, marginTop: 6 },
  noteWrap: { paddingHorizontal: 14, marginTop: 4 },
  note: { fontSize: 14, lineHeight: 19 },
});
