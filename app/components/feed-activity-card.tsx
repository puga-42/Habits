import { useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { FeedActionBar } from '@/components/feed-action-bar';
import { FeedAvatar } from '@/components/feed-avatar';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { FeedItem } from '@/lib/feed';
import { feedItemSortKey, formatRelativeTime } from '@/lib/feed';

type Props = {
  item: FeedItem;
  viewerId: string;
  now: Date;
  onToggleLike: () => void;
  onOpenComments: () => void;
  onHabitPress: () => void;
  onReport: () => void;
  onBlock: () => void;
  onMute: () => void;
};

export function FeedActivityCard({
  item,
  viewerId,
  now,
  onToggleLike,
  onOpenComments,
  onHabitPress,
  onReport,
  onBlock,
  onMute,
}: Props) {
  const router = useRouter();
  const isSelf = item.owner_id === viewerId;
  const goToUser = () => router.push(`/user/${item.owner_id}`);

  const openOverflow = () => {
    const buttons: {
      text: string;
      onPress?: () => void;
      style?: 'destructive' | 'cancel';
    }[] = [];
    if (!isSelf) {
      buttons.push({ text: 'Report content', onPress: onReport });
      buttons.push({
        text: 'Block user',
        onPress: onBlock,
        style: 'destructive',
      });
    }
    buttons.push({ text: 'Mute this habit', onPress: onMute });
    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Options', undefined, buttons, { cancelable: true });
  };

  const fallbackColor = item.habit_color ?? 'rgba(127,127,127,0.45)';

  return (
    <View style={styles.card}>
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
        <Pressable
          onPress={openOverflow}
          hitSlop={10}
          style={styles.menuButton}>
          <IconSymbol
            name="ellipsis"
            color="rgba(127,127,127,0.9)"
            size={22}
          />
        </Pressable>
      </View>

      <Pressable style={styles.habitLine} onPress={onHabitPress}>
        <ThemedText style={styles.habitVerb}>
          {item.event_type === 'adopted' ? 'adopted ' : 'started '}
        </ThemedText>
        <ThemedText style={styles.habitTitle}>{item.habit_title}</ThemedText>
        {item.habit_icon ? (
          <ThemedText style={styles.habitIcon}> {item.habit_icon}</ThemedText>
        ) : null}
        {item.event_type === 'adopted' && item.adopted_from_handle ? (
          <ThemedText style={styles.adoptedFrom}>
            {' '}from @{item.adopted_from_handle}
          </ThemedText>
        ) : null}
      </Pressable>

      <View style={styles.actionWrap}>
        <FeedActionBar
          targetId={item.id}
          targetKind="habit_created"
          likeCount={item.like_count}
          commentCount={item.comment_count}
          viewerLiked={item.viewer_liked}
          onToggleLike={onToggleLike}
          onOpenComments={onOpenComments}
        />
      </View>
    </View>
  );
}

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
  habitLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: 14,
    marginTop: 6,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  habitVerb: { fontSize: 14, opacity: 0.7 },
  habitTitle: { fontSize: 15, fontWeight: '600' },
  habitIcon: { fontSize: 16 },
  adoptedFrom: { fontSize: 13, opacity: 0.5 },
  actionWrap: { paddingHorizontal: 14, marginTop: 6 },
});
