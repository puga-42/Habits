import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useDrawer } from '@/components/drawer-provider';
import { NotificationItem } from '@/components/notification-item';
import { TabTopBar } from '@/components/tab-top-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useUnreadCount } from '@/components/unread-count-provider';
import { Palette } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import {
  fetchNotifications,
  markAllRead,
  markRead,
  type AppNotification,
  type NotificationCursor,
} from '@/lib/notifications';

const PAGE_SIZE = 30;

export default function NotificationsScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const { openDrawer } = useDrawer();
  const { refreshUnreadCount } = useUnreadCount();

  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [paging, setPaging] = useState(false);
  const [reachedEnd, setReachedEnd] = useState(false);
  const now = useRef(new Date()).current;

  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    try {
      const page = await fetchNotifications(undefined, PAGE_SIZE);
      setItems(page);
      setReachedEnd(page.length < PAGE_SIZE);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!session?.user.id) return;
      loadFirstPage();
    }, [session?.user.id, loadFirstPage]),
  );

  async function onRefresh() {
    setRefreshing(true);
    try {
      const page = await fetchNotifications(undefined, PAGE_SIZE);
      setItems(page);
      setReachedEnd(page.length < PAGE_SIZE);
      refreshUnreadCount();
    } finally {
      setRefreshing(false);
    }
  }

  async function onEndReached() {
    if (paging || reachedEnd || items.length === 0) return;
    setPaging(true);
    try {
      const last = items[items.length - 1];
      const cursor: NotificationCursor = { created_at: last.created_at, id: last.id };
      const page = await fetchNotifications(cursor, PAGE_SIZE);
      setItems((prev) => [...prev, ...page]);
      setReachedEnd(page.length < PAGE_SIZE);
    } finally {
      setPaging(false);
    }
  }

  async function onPressItem(n: AppNotification) {
    if (!n.read) {
      setItems((prev) =>
        prev.map((i) => (i.id === n.id ? { ...i, read: true } : i)),
      );
      markRead(n.id).then(refreshUnreadCount).catch(() => {});
    }
    const isCompletionRelated =
      n.kind === 'completion_like' || n.kind === 'completion_comment' || n.kind === 'comment_like';
    if (isCompletionRelated) {
      router.push(`/completion/${n.target_id}`);
    } else {
      router.push('/(tabs)/feed');
    }
  }

  async function onMarkAllRead() {
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    await markAllRead();
    refreshUnreadCount();
  }

  const markAllButton = items.some((i) => !i.read) ? (
    <Pressable onPress={onMarkAllRead} hitSlop={8}>
      <ThemedText style={styles.markAll}>Mark all read</ThemedText>
    </Pressable>
  ) : undefined;

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <TabTopBar
          title="Notifications"
          onMenuPress={openDrawer}
          rightSlot={markAllButton}
        />
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <NotificationItem notification={item} onPress={onPressItem} now={now} />
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            loading ? (
              <View style={styles.center}>
                <ActivityIndicator />
              </View>
            ) : (
              <View style={styles.center}>
                <ThemedText style={styles.empty}>No notifications yet</ThemedText>
              </View>
            )
          }
          ListFooterComponent={
            paging ? <ActivityIndicator style={styles.footer} /> : null
          }
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  empty: { color: Palette.coolGray, fontSize: 15 },
  footer: { paddingVertical: 16 },
  markAll: { fontSize: 14, color: Palette.primary },
});
