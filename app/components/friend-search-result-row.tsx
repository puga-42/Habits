import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { FeedAvatar } from '@/components/feed-avatar';
import { ThemedText } from '@/components/themed-text';
import type { SearchResult } from '@/lib/friends';

type Props = {
  result: SearchResult;
  onSendRequest: () => void;
  onAcceptRequest: () => void;
  loading?: boolean;
};

export function FriendSearchResultRow({
  result,
  onSendRequest,
  onAcceptRequest,
  loading,
}: Props) {
  const { label, onPress, accent } = buttonConfig(
    result.friendship_status,
    onSendRequest,
    onAcceptRequest,
  );
  const disabled =
    loading ||
    result.friendship_status === 'friend' ||
    result.friendship_status === 'pending_outgoing';

  return (
    <View style={styles.row}>
      <FeedAvatar
        url={result.avatar_url}
        displayName={result.display_name}
        size={36}
      />
      <View style={styles.info}>
        <ThemedText style={styles.displayName} numberOfLines={1}>
          {result.display_name}
        </ThemedText>
        <ThemedText style={styles.handle} numberOfLines={1}>
          @{result.handle}
        </ThemedText>
      </View>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={[
          styles.button,
          accent ? styles.buttonAccent : styles.buttonGhost,
          disabled && styles.buttonDisabled,
        ]}>
        {loading ? (
          <ActivityIndicator size="small" color={accent ? '#fff' : '#888'} />
        ) : (
          <ThemedText
            style={[
              styles.buttonText,
              accent ? styles.buttonTextAccent : styles.buttonTextGhost,
            ]}>
            {label}
          </ThemedText>
        )}
      </Pressable>
    </View>
  );
}

function buttonConfig(
  status: SearchResult['friendship_status'],
  onSendRequest: () => void,
  onAcceptRequest: () => void,
): { label: string; onPress: () => void; accent: boolean } {
  switch (status) {
    case 'none':
      return { label: 'Add', onPress: onSendRequest, accent: true };
    case 'pending_outgoing':
      return { label: 'Pending', onPress: () => {}, accent: false };
    case 'pending_incoming':
      return { label: 'Accept', onPress: onAcceptRequest, accent: true };
    case 'friend':
      return { label: 'Friends', onPress: () => {}, accent: false };
  }
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
  button: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 72,
    alignItems: 'center',
  },
  buttonAccent: { backgroundColor: '#0a7ea4' },
  buttonGhost: {
    backgroundColor: 'rgba(127,127,127,0.12)',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontSize: 13, fontWeight: '600' },
  buttonTextAccent: { color: '#fff' },
  buttonTextGhost: { opacity: 0.7 },
});
