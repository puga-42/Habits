import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FeedAvatar } from '@/components/feed-avatar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import type { FriendProfile } from '@/lib/friends';
import { fetchMutualFriends } from '@/lib/user-profile';

type Props = {
  visible: boolean;
  targetId: string;
  onClose: () => void;
};

export function MutualFriendsModal({ visible, targetId, onClose }: Props) {
  const router = useRouter();
  const [friends, setFriends] = useState<FriendProfile[]>([]);

  useEffect(() => {
    if (!visible) return;
    fetchMutualFriends(targetId, 50).then(setFriends).catch(() => {});
  }, [visible, targetId]);

  const goToUser = useCallback((userId: string) => {
    onClose();
    router.push(`/user/${userId}`);
  }, [onClose, router]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <ThemedView style={styles.root}>
        <SafeAreaView edges={['top']} style={styles.content}>
          <View style={styles.header}>
            <View style={styles.headerSide} />
            <ThemedText type="defaultSemiBold">Mutual friends</ThemedText>
            <Pressable onPress={onClose} hitSlop={12} style={styles.headerSide}>
              <ThemedText style={styles.done}>Done</ThemedText>
            </Pressable>
          </View>
          <FlatList
            data={friends}
            keyExtractor={(f) => f.id}
            renderItem={({ item }) => (
              <Pressable onPress={() => goToUser(item.id)} style={styles.row}>
                <FeedAvatar
                  url={item.avatar_url}
                  handle={item.handle}
                  size={40}
                />
                <ThemedText style={styles.handle} numberOfLines={1}>
                  @{item.handle}
                </ThemedText>
              </Pressable>
            )}
            ListEmptyComponent={
              <ThemedText style={styles.empty}>No mutual friends</ThemedText>
            }
          />
        </SafeAreaView>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(127,127,127,0.25)',
  },
  headerSide: { width: 60 },
  done: { fontSize: 16, fontWeight: '600', textAlign: 'right' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  handle: { fontSize: 15, fontWeight: '600', flex: 1 },
  empty: { textAlign: 'center', opacity: 0.5, paddingTop: 40, fontSize: 15 },
});
