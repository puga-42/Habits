// One feed card. Header (avatar + handle + relative time + overflow menu),
// the habit line ("completed Meditate 🧘"), optional attachment carousel,
// optional note excerpt, action bar.

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { FeedActionBar } from '@/components/feed-action-bar';
import { FeedAttachmentCarousel } from '@/components/feed-attachment-carousel';
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
  onEdit?: () => void;
  onReport: () => void;
  onBlock: () => void;
  onMute: () => void;
};

export function FeedCard({
  item,
  viewerId,
  now,
  onToggleLike,
  onOpenComments,
  onEdit,
  onReport,
  onBlock,
  onMute,
}: Props) {
  const router = useRouter();
  const [noteExpanded, setNoteExpanded] = useState(false);
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
        {isSelf && onEdit && (
          <Pressable onPress={onEdit} hitSlop={10} style={styles.menuButton}>
            <IconSymbol name="pencil" color="rgba(127,127,127,0.9)" size={18} />
          </Pressable>
        )}
        <Pressable onPress={openOverflow} hitSlop={10} style={styles.menuButton}>
          <IconSymbol name="ellipsis" color="rgba(127,127,127,0.9)" size={22} />
        </Pressable>
      </View>

      <View style={styles.habitLine}>
        <ThemedText style={styles.habitVerb}>completed </ThemedText>
        <ThemedText style={styles.habitTitle}>{item.habit_title}</ThemedText>
        {item.habit_icon ? (
          <ThemedText style={styles.habitIcon}> {item.habit_icon}</ThemedText>
        ) : null}
      </View>

      {item.attachments.length > 0 ? (
        <View style={styles.attachmentWrap}>
          <FeedAttachmentCarousel attachments={item.attachments} />
        </View>
      ) : null}

      {item.note ? (
        <Pressable onPress={() => setNoteExpanded((v) => !v)} style={styles.noteWrap}>
          <ThemedText style={styles.note} numberOfLines={noteExpanded ? undefined : 2}>
            {item.note}
          </ThemedText>
        </Pressable>
      ) : null}

      <View style={styles.actionWrap}>
        <FeedActionBar
          targetId={item.id}
          targetKind="completion"
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
  attachmentWrap: { marginBottom: 4 },
  actionWrap: { paddingHorizontal: 14, marginTop: 6 },
  noteWrap: { paddingHorizontal: 14, marginTop: 4 },
  note: { fontSize: 14, lineHeight: 19 },
});
