// Likers list — paginated profiles who liked a completion or a comment.
// Route: /likers/<completion|comment>/<id>

import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';

import { FeedAvatar } from '@/components/feed-avatar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  fetchLikers,
  formatRelativeTime,
  type Liker,
  type LikerCursor,
} from '@/lib/feed';

const PAGE_SIZE = 50;

export default function LikersScreen() {
  const params = useLocalSearchParams<{ kind: string; id: string }>();
  const kind = params.kind === 'comment' ? 'comment' : 'completion';
  const targetId = params.id ?? '';
  const [items, setItems] = useState<Liker[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [paging, setPaging] = useState(false);
  const [reachedEnd, setReachedEnd] = useState(false);
  const now = useRef(new Date()).current;

  const loadFirst = useCallback(async () => {
    if (!targetId) return;
    setLoading(true);
    try {
      const page = await fetchLikers({ kind, id: targetId }, undefined, PAGE_SIZE);
      setItems(page);
      setReachedEnd(page.length < PAGE_SIZE);
    } finally {
      setLoading(false);
    }
  }, [kind, targetId]);

  useEffect(() => {
    loadFirst();
  }, [loadFirst]);

  const loadMore = useCallback(async () => {
    if (paging || reachedEnd || items.length === 0) return;
    const last = items[items.length - 1];
    const cursor: LikerCursor = { liked_at: last.liked_at, user_id: last.user_id };
    setPaging(true);
    try {
      const next = await fetchLikers({ kind, id: targetId }, cursor, PAGE_SIZE);
      setItems((prev) => [...prev, ...next]);
      if (next.length < PAGE_SIZE) setReachedEnd(true);
    } finally {
      setPaging(false);
    }
  }, [items, paging, reachedEnd, kind, targetId]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadFirst();
    } finally {
      setRefreshing(false);
    }
  }, [loadFirst]);

  return (
    <ThemedView style={styles.root}>
      <Stack.Screen options={{ title: 'Likes', headerBackTitle: 'Back' }} />
      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <ThemedText style={styles.empty}>No likes yet.</ThemedText>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(l) => l.user_id}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <FeedAvatar
                url={item.avatar_url}
                handle={item.handle}
                size={36}
              />
              <View style={styles.body}>
                <ThemedText style={styles.name} numberOfLines={1}>
                  @{item.handle}
                </ThemedText>
              </View>
              <ThemedText style={styles.time}>
                {formatRelativeTime(item.liked_at, now)}
              </ThemedText>
            </View>
          )}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} />
          }
          ListFooterComponent={
            paging ? (
              <View style={styles.footer}>
                <ActivityIndicator />
              </View>
            ) : null
          }
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  empty: { opacity: 0.55 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  body: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600' },
  time: { fontSize: 12, opacity: 0.5 },
  footer: { paddingVertical: 14, alignItems: 'center' },
});
