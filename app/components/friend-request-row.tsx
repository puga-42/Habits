import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Palette } from '@/constants/colors';
import { FeedAvatar } from '@/components/feed-avatar';
import { ThemedText } from '@/components/themed-text';
import type { FriendRequest } from '@/lib/friends';

type Props = {
  request: FriendRequest;
  direction: 'incoming' | 'outgoing';
  onAccept: () => void;
  onDecline: () => void;
  onCancel: () => void;
  loading?: boolean;
};

export function FriendRequestRow({
  request,
  direction,
  onAccept,
  onDecline,
  onCancel,
  loading,
}: Props) {
  return (
    <View style={styles.row}>
      <FeedAvatar
        url={request.profile.avatar_url}
        handle={request.profile.handle}
        size={40}
      />
      <View style={styles.info}>
        <ThemedText style={styles.handle} numberOfLines={1}>
          @{request.profile.handle}
        </ThemedText>
      </View>
      {loading ? (
        <ActivityIndicator size="small" />
      ) : direction === 'incoming' ? (
        <View style={styles.actions}>
          <Pressable onPress={onAccept} style={[styles.button, styles.buttonAccent]}>
            <ThemedText style={[styles.buttonText, styles.buttonTextAccent]}>
              Accept
            </ThemedText>
          </Pressable>
          <Pressable onPress={onDecline} style={[styles.button, styles.buttonGhost]}>
            <ThemedText style={[styles.buttonText, styles.buttonTextGhost]}>
              Decline
            </ThemedText>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={onCancel} style={[styles.button, styles.buttonGhost]}>
          <ThemedText style={[styles.buttonText, styles.buttonTextGhost]}>
            Cancel
          </ThemedText>
        </Pressable>
      )}
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
  handle: { fontSize: 15, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 8 },
  button: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    alignItems: 'center',
  },
  buttonAccent: { backgroundColor: Palette.primary },
  buttonGhost: { backgroundColor: Palette.blushMuted },
  buttonText: { fontSize: 13, fontWeight: '600' },
  buttonTextAccent: { color: '#fff' },
  buttonTextGhost: { opacity: 0.7 },
});
