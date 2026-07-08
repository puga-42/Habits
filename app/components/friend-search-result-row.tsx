import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { FeedAvatar } from '@/components/feed-avatar';
import { ThemedText } from '@/components/themed-text';
import { useTokens } from '@/hooks/use-tokens';
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
  const router = useRouter();
  const t = useTokens();
  const goToUser = () => router.push(`/user/${result.id}`);
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
      <Pressable onPress={goToUser} style={styles.rowMain}>
        <FeedAvatar
          url={result.avatar_url}
          handle={result.handle}
          size={36}
        />
        <View style={styles.info}>
          <ThemedText style={styles.handle} numberOfLines={1}>
            @{result.handle}
          </ThemedText>
        </View>
      </Pressable>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={[
          styles.button,
          accent ? { backgroundColor: t.accent } : { backgroundColor: t.surfaceRaised },
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
  rowMain: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  info: { flex: 1 },
  handle: { fontSize: 15, fontWeight: '600' },
  button: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 72,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontSize: 13, fontWeight: '600' },
  buttonTextAccent: { color: '#fff' },
  buttonTextGhost: { opacity: 0.7 },
});
