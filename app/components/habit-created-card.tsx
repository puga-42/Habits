import { StyleSheet, View } from 'react-native';

import { FeedAvatar } from '@/components/feed-avatar';
import { ThemedText } from '@/components/themed-text';
import type { HabitActivityItem } from '@/lib/feed';
import { formatRelativeTime } from '@/lib/feed';

type Props = {
  item: HabitActivityItem;
  now: Date;
};

export function HabitCreatedCard({ item, now }: Props) {
  const tintColor = item.habit_color ?? undefined;
  const iconLabel = item.habit_icon ? `${item.habit_icon} ` : '';

  return (
    <View style={styles.card}>
      <FeedAvatar
        url={item.owner_avatar_url}
        displayName={item.owner_display_name}
        size={36}
        tintColor={tintColor}
      />
      <View style={styles.body}>
        <View style={styles.headerRow}>
          <ThemedText style={styles.handle}>@{item.owner_handle}</ThemedText>
          <ThemedText style={styles.time}>
            {formatRelativeTime(item.created_at, now)}
          </ThemedText>
        </View>
        <ThemedText style={styles.action} numberOfLines={2}>
          started tracking{' '}
          <ThemedText style={styles.habitName}>
            {iconLabel}{item.habit_title}
          </ThemedText>
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  body: { flex: 1, gap: 2 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  handle: { fontSize: 14, fontWeight: '600' },
  time: { fontSize: 12, opacity: 0.5 },
  action: { fontSize: 14, opacity: 0.75 },
  habitName: { fontWeight: '600', opacity: 1 },
});
