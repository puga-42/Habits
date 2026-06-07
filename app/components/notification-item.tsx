import { Pressable, StyleSheet, View } from 'react-native';

import { FeedAvatar } from '@/components/feed-avatar';
import { ThemedText } from '@/components/themed-text';
import { Palette } from '@/constants/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatRelativeTime } from '@/lib/feed';
import { notificationMessage, type AppNotification } from '@/lib/notifications';

type Props = {
  notification: AppNotification;
  onPress: (notification: AppNotification) => void;
  now: Date;
};

export function NotificationItem({ notification, onPress, now }: Props) {
  const colorScheme = useColorScheme();
  const unreadBg = colorScheme === 'dark'
    ? 'rgba(9, 237, 226, 0.06)'
    : 'rgba(9, 237, 226, 0.08)';

  return (
    <Pressable
      style={[styles.row, !notification.read && { backgroundColor: unreadBg }]}
      onPress={() => onPress(notification)}
    >
      <FeedAvatar
        url={notification.actor_avatar_url}
        handle={notification.actor_handle}
        size={40}
      />
      <View style={styles.body}>
        <ThemedText style={styles.message} numberOfLines={2}>
          <ThemedText type="defaultSemiBold">@{notification.actor_handle}</ThemedText>
          {' '}
          {notificationMessage(notification)}
        </ThemedText>
        <ThemedText style={styles.time}>
          {formatRelativeTime(notification.created_at, now)}
        </ThemedText>
      </View>
      {!notification.read && <View style={styles.dot} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  body: { flex: 1 },
  message: { fontSize: 14, lineHeight: 20 },
  time: { fontSize: 12, color: Palette.coolGray, marginTop: 2 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Palette.primary,
  },
});
