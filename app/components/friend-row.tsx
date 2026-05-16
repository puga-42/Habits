import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { FeedAvatar } from '@/components/feed-avatar';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { FriendProfile } from '@/lib/friends';

type Props = {
  friend: FriendProfile;
  onUnfriend: () => void;
};

export function FriendRow({ friend, onUnfriend }: Props) {
  const openOverflow = () => {
    Alert.alert(
      `Remove ${friend.display_name}?`,
      'You can send them a new request later.',
      [
        { text: 'Remove', style: 'destructive', onPress: onUnfriend },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  return (
    <View style={styles.row}>
      <FeedAvatar
        url={friend.avatar_url}
        displayName={friend.display_name}
        size={40}
      />
      <View style={styles.info}>
        <ThemedText style={styles.displayName} numberOfLines={1}>
          {friend.display_name}
        </ThemedText>
        <ThemedText style={styles.handle} numberOfLines={1}>
          @{friend.handle}
        </ThemedText>
      </View>
      <Pressable onPress={openOverflow} hitSlop={10} style={styles.menuButton}>
        <IconSymbol name="ellipsis" color="rgba(127,127,127,0.9)" size={20} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  info: { flex: 1 },
  displayName: { fontSize: 15, fontWeight: '600' },
  handle: { fontSize: 12, opacity: 0.55, marginTop: 1 },
  menuButton: { padding: 4 },
});
