import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useDrawer } from '@/components/drawer-provider';
import { usePendingCount } from '@/components/pending-count-provider';
import { FriendRequestRow } from '@/components/friend-request-row';
import { FriendRow } from '@/components/friend-row';
import { FriendSearchBar } from '@/components/friend-search-bar';
import { FriendSearchResultRow } from '@/components/friend-search-result-row';
import { ScreenHeader } from '@/components/screen-header';
import { TabTopBar } from '@/components/tab-top-bar';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/lib/auth';
import {
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  fetchFriendsPage,
  fetchIncomingRequests,
  fetchOutgoingRequests,
  mergeFriendsPages,
  removeFriend,
  searchProfiles,
  sendFriendRequest,
  subscribeToFriendEvents,
  type FriendProfile,
  type FriendRequest,
  type SearchResult,
} from '@/lib/friends';

const FRIENDS_PAGE_SIZE = 30;

export default function FriendsScreen() {
  const { session } = useAuth();
  const { openDrawer } = useDrawer();
  const { refreshPendingCount } = usePendingCount();
  const backgroundColor = useThemeColor({}, 'background');
  const viewerId = session?.user.id ?? null;

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<FriendProfile[]>([]);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [paging, setPaging] = useState(false);
  const [reachedEnd, setReachedEnd] = useState(false);

  const [requestsExpanded, setRequestsExpanded] = useState(true);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // ─── Initial load ────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [inc, out, page] = await Promise.all([
        fetchIncomingRequests(),
        fetchOutgoingRequests(),
        fetchFriendsPage(undefined, FRIENDS_PAGE_SIZE),
      ]);
      setIncoming(inc);
      setOutgoing(out);
      setFriends(page);
      setReachedEnd(page.length < FRIENDS_PAGE_SIZE);
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Refetch on focus + Realtime while focused ───────────────────────

  useFocusEffect(
    useCallback(() => {
      if (!viewerId) return;
      loadAll();
      const unsub = subscribeToFriendEvents({
        onRequestChange: () => {
          fetchIncomingRequests().then(setIncoming);
          fetchOutgoingRequests().then(setOutgoing);
        },
        onFriendshipChange: () => {
          fetchFriendsPage(undefined, FRIENDS_PAGE_SIZE).then(setFriends);
        },
      });
      return unsub;
    }, [viewerId, loadAll]),
  );

  // ─── Search ──────────────────────────────────────────────────────────

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    clearTimeout(debounceRef.current);
    if (text.trim().length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchProfiles(text.trim());
        setSearchResults(results);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, []);

  const handleSearchClear = useCallback(() => {
    clearTimeout(debounceRef.current);
    setSearchQuery('');
    setSearchResults([]);
    setSearching(false);
  }, []);

  // ─── Pagination ──────────────────────────────────────────────────────

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadAll();
    } finally {
      setRefreshing(false);
    }
  }, [loadAll]);

  const loadMore = useCallback(async () => {
    if (paging || reachedEnd || friends.length === 0) return;
    const last = friends[friends.length - 1];
    setPaging(true);
    try {
      const next = await fetchFriendsPage(
        { handle: last.handle, id: last.id },
        FRIENDS_PAGE_SIZE,
      );
      setFriends((prev) => mergeFriendsPages(prev, next));
      if (next.length < FRIENDS_PAGE_SIZE) setReachedEnd(true);
    } finally {
      setPaging(false);
    }
  }, [friends, paging, reachedEnd]);

  // ─── Mutations ───────────────────────────────────────────────────────

  const handleSendRequest = useCallback(
    async (toUser: string) => {
      if (!viewerId) return;
      setLoadingAction(toUser);
      try {
        await sendFriendRequest(viewerId, toUser);
        setSearchResults((prev) =>
          prev.map((r) =>
            r.id === toUser
              ? { ...r, friendship_status: 'pending_outgoing' as const }
              : r,
          ),
        );
        fetchOutgoingRequests().then(setOutgoing);
      } catch {
        // unique violation or other error — refresh search
        if (searchQuery.trim().length >= 2) {
          const results = await searchProfiles(searchQuery.trim());
          setSearchResults(results);
        }
      } finally {
        setLoadingAction(null);
      }
    },
    [viewerId, searchQuery],
  );

  const handleAcceptFromSearch = useCallback(
    async (result: SearchResult) => {
      let req = incoming.find((r) => r.profile.id === result.id);
      if (!req) {
        const fresh = await fetchIncomingRequests();
        setIncoming(fresh);
        req = fresh.find((r) => r.profile.id === result.id);
        if (!req) return;
      }
      setLoadingAction(result.id);
      try {
        await acceptFriendRequest(req.id);
        setIncoming((prev) => prev.filter((r) => r.id !== req.id));
        setSearchResults((prev) =>
          prev.map((r) =>
            r.id === result.id
              ? { ...r, friendship_status: 'friend' as const }
              : r,
          ),
        );
        fetchFriendsPage(undefined, FRIENDS_PAGE_SIZE).then(setFriends);
        refreshPendingCount();
      } catch {
        fetchIncomingRequests().then(setIncoming);
      } finally {
        setLoadingAction(null);
      }
    },
    [incoming, refreshPendingCount],
  );

  const handleAcceptRequest = useCallback(
    async (requestId: string) => {
      setLoadingAction(requestId);
      try {
        await acceptFriendRequest(requestId);
        setIncoming((prev) => prev.filter((r) => r.id !== requestId));
        fetchFriendsPage(undefined, FRIENDS_PAGE_SIZE).then(setFriends);
        refreshPendingCount();
      } catch {
        fetchIncomingRequests().then(setIncoming);
      } finally {
        setLoadingAction(null);
      }
    },
    [refreshPendingCount],
  );

  const handleDeclineRequest = useCallback(async (requestId: string) => {
    setLoadingAction(requestId);
    setIncoming((prev) => prev.filter((r) => r.id !== requestId));
    try {
      await declineFriendRequest(requestId);
      refreshPendingCount();
    } catch {
      fetchIncomingRequests().then(setIncoming);
    } finally {
      setLoadingAction(null);
    }
  }, [refreshPendingCount]);

  const handleCancelRequest = useCallback(async (requestId: string) => {
    setLoadingAction(requestId);
    setOutgoing((prev) => prev.filter((r) => r.id !== requestId));
    try {
      await cancelFriendRequest(requestId);
    } catch {
      fetchOutgoingRequests().then(setOutgoing);
    } finally {
      setLoadingAction(null);
    }
  }, []);

  const handleUnfriend = useCallback(
    async (friendId: string) => {
      if (!viewerId) return;
      setFriends((prev) => prev.filter((f) => f.id !== friendId));
      try {
        await removeFriend(viewerId, friendId);
      } catch {
        fetchFriendsPage(undefined, FRIENDS_PAGE_SIZE).then(setFriends);
      }
    },
    [viewerId],
  );

  // ─── Render ──────────────────────────────────────────────────────────

  if (!viewerId) {
    return (
      <Pressable style={[styles.root, { backgroundColor }]} onPress={Keyboard.dismiss}>
        <SafeAreaView edges={[]} style={styles.content}>
          <ScreenHeader>
            <TabTopBar title="Friends" onMenuPress={openDrawer} />
          </ScreenHeader>
        </SafeAreaView>
      </Pressable>
    );
  }

  const isSearchActive = searchQuery.trim().length >= 2;
  const hasRequests = incoming.length + outgoing.length > 0;
  const showEmpty = !loading && friends.length === 0 && !hasRequests;

  return (
    <Pressable style={[styles.root, { backgroundColor }]} onPress={Keyboard.dismiss}>
      <SafeAreaView edges={[]} style={styles.safe}>
        <ScreenHeader>
          <TabTopBar title="Friends" onMenuPress={openDrawer} />
          <FriendSearchBar
            value={searchQuery}
            onChangeText={handleSearchChange}
            onClear={handleSearchClear}
          />
        </ScreenHeader>

        {isSearchActive ? (
          searching ? (
            <View style={styles.center}>
              <ActivityIndicator />
            </View>
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={(r) => r.id}
              renderItem={({ item }) => (
                <FriendSearchResultRow
                  result={item}
                  onSendRequest={() => handleSendRequest(item.id)}
                  onAcceptRequest={() => handleAcceptFromSearch(item)}
                  loading={loadingAction === item.id}
                />
              )}
              ListEmptyComponent={
                <ThemedText style={styles.emptyText}>No users found.</ThemedText>
              }
              keyboardShouldPersistTaps="handled"
            />
          )
        ) : loading && friends.length === 0 && !hasRequests ? (
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        ) : showEmpty ? (
          <View style={styles.emptyContainer}>
            <ThemedText style={styles.emptyTitle}>No friends yet</ThemedText>
            <ThemedText style={styles.emptyText}>
              Search by handle to find people.
            </ThemedText>
          </View>
        ) : (
          <FlatList
            data={friends}
            keyExtractor={(f) => f.id}
            renderItem={({ item }) => (
              <FriendRow
                friend={item}
                onUnfriend={() => handleUnfriend(item.id)}
              />
            )}
            ListHeaderComponent={
              hasRequests ? (
                <RequestsSection
                  incoming={incoming}
                  outgoing={outgoing}
                  expanded={requestsExpanded}
                  onToggle={() => setRequestsExpanded((v) => !v)}
                  loadingAction={loadingAction}
                  onAccept={handleAcceptRequest}
                  onDecline={handleDeclineRequest}
                  onCancel={handleCancelRequest}
                />
              ) : null
            }
            ItemSeparatorComponent={Separator}
            ListFooterComponent={
              paging ? (
                <View style={styles.footer}>
                  <ActivityIndicator />
                </View>
              ) : null
            }
            onEndReached={loadMore}
            onEndReachedThreshold={0.4}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={refresh} />
            }
          />
        )}
      </SafeAreaView>
    </Pressable>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────

function RequestsSection({
  incoming,
  outgoing,
  expanded,
  onToggle,
  loadingAction,
  onAccept,
  onDecline,
  onCancel,
}: {
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
  expanded: boolean;
  onToggle: () => void;
  loadingAction: string | null;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  const total = incoming.length + outgoing.length;

  return (
    <View style={styles.requestsSection}>
      <Pressable onPress={onToggle} style={styles.requestsHeader}>
        <ThemedText style={styles.requestsTitle}>
          Requests ({total})
        </ThemedText>
        <IconSymbol
          name={expanded ? 'chevron.up' : 'chevron.down'}
          size={14}
          color="rgba(127,127,127,0.6)"
        />
      </Pressable>

      {expanded && (
        <>
          {incoming.map((req) => (
            <FriendRequestRow
              key={req.id}
              request={req}
              direction="incoming"
              onAccept={() => onAccept(req.id)}
              onDecline={() => onDecline(req.id)}
              onCancel={() => {}}
              loading={loadingAction === req.id}
            />
          ))}
          {outgoing.map((req) => (
            <FriendRequestRow
              key={req.id}
              request={req}
              direction="outgoing"
              onAccept={() => {}}
              onDecline={() => {}}
              onCancel={() => onCancel(req.id)}
              loading={loadingAction === req.id}
            />
          ))}
        </>
      )}

      <View style={styles.sectionSeparator} />
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

// ─── Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 8,
  },
  emptyTitle: { fontSize: 17, fontWeight: '600', opacity: 0.6 },
  emptyText: {
    fontSize: 14,
    opacity: 0.5,
    textAlign: 'center',
    paddingHorizontal: 40,
    paddingTop: 20,
  },
  requestsSection: { marginBottom: 4 },
  requestsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  requestsTitle: { fontSize: 14, fontWeight: '600', opacity: 0.6 },
  sectionSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(127,127,127,0.25)',
    marginHorizontal: 14,
    marginTop: 6,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(127,127,127,0.25)',
    marginHorizontal: 14,
  },
  footer: { paddingVertical: 18, alignItems: 'center' },
});
