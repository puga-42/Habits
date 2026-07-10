// Friends — types, RPC-backed queries, mutations, Realtime, pure helpers.
// Pure helpers are TDD'd; see __tests__/friends.test.ts.

import { supabase } from './supabase';
import { uniqueChannelName } from './realtime-channel-name';

// ─── Types ─────────────────────────────────────────────────────────────────

export type FriendshipStatus =
  | 'friend'
  | 'pending_incoming'
  | 'pending_outgoing'
  | 'none';

export type FriendProfile = {
  id: string;
  handle: string;
  avatar_url: string | null;
};

export type SearchResult = FriendProfile & {
  friendship_status: FriendshipStatus;
};

export type FriendRequest = {
  id: string;
  from_user: string;
  to_user: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  responded_at: string | null;
  profile: FriendProfile;
};

export type FriendCursor = { handle: string; id: string };
export type RequestCursor = { created_at: string; id: string };

// ─── Queries (RPC-backed) ──────────────────────────────────────────────────

export async function searchProfiles(
  query: string,
  limit = 20,
): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const { data, error } = await supabase.rpc('search_profiles', {
    query: trimmed,
    page_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as SearchResult[];
}

export async function fetchFriendsPage(
  cursor?: FriendCursor,
  limit = 30,
): Promise<FriendProfile[]> {
  const { data, error } = await supabase.rpc('fetch_friends_page', {
    cursor_handle: cursor?.handle ?? null,
    cursor_id: cursor?.id ?? null,
    page_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as FriendProfile[];
}

export async function fetchIncomingRequests(
  cursor?: RequestCursor,
  limit = 20,
): Promise<FriendRequest[]> {
  const { data, error } = await supabase.rpc('fetch_friend_requests_page', {
    direction: 'incoming',
    cursor_created_at: cursor?.created_at ?? null,
    cursor_id: cursor?.id ?? null,
    page_limit: limit,
  });
  if (error) throw error;
  return mapRequestRows(data ?? []);
}

export async function fetchOutgoingRequests(
  cursor?: RequestCursor,
  limit = 20,
): Promise<FriendRequest[]> {
  const { data, error } = await supabase.rpc('fetch_friend_requests_page', {
    direction: 'outgoing',
    cursor_created_at: cursor?.created_at ?? null,
    cursor_id: cursor?.id ?? null,
    page_limit: limit,
  });
  if (error) throw error;
  return mapRequestRows(data ?? []);
}

export async function fetchPendingRequestCount(
  userId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('friend_requests')
    .select('*', { count: 'exact', head: true })
    .eq('to_user', userId)
    .eq('status', 'pending');
  if (error) throw error;
  return count ?? 0;
}

// ─── Mutations ─────────────────────────────────────────────────────────────

export async function sendFriendRequest(
  fromUser: string,
  toUser: string,
): Promise<FriendRequest> {
  const { data, error } = await supabase
    .from('friend_requests')
    .insert({ from_user: fromUser, to_user: toUser })
    .select(
      `id, from_user, to_user, status, created_at, responded_at,
       profiles:to_user (id, handle, avatar_url)`,
    )
    .single();
  if (error) throw error;
  const row = data as unknown as {
    id: string;
    from_user: string;
    to_user: string;
    status: 'pending';
    created_at: string;
    responded_at: string | null;
    profiles: {
      id: string;
      handle: string;
      avatar_url: string | null;
    };
  };
  return {
    id: row.id,
    from_user: row.from_user,
    to_user: row.to_user,
    status: row.status,
    created_at: row.created_at,
    responded_at: row.responded_at,
    profile: row.profiles,
  };
}

export async function acceptFriendRequest(requestId: string): Promise<void> {
  const { error } = await supabase.rpc('accept_friend_request', {
    request_id: requestId,
  });
  if (error) throw error;
}

export async function declineFriendRequest(requestId: string): Promise<void> {
  const { error } = await supabase
    .from('friend_requests')
    .update({ status: 'declined', responded_at: new Date().toISOString() })
    .eq('id', requestId);
  if (error) throw error;
}

export async function cancelFriendRequest(requestId: string): Promise<void> {
  const { error } = await supabase
    .from('friend_requests')
    .delete()
    .eq('id', requestId);
  if (error) throw error;
}

export async function removeFriend(
  userId: string,
  friendId: string,
): Promise<void> {
  const { error } = await supabase
    .from('friendships')
    .delete()
    .eq('user_a', canonicalA(userId, friendId))
    .eq('user_b', canonicalB(userId, friendId));
  if (error) throw error;
}

// ─── Realtime ──────────────────────────────────────────────────────────────

export type FriendsRealtimeHandlers = {
  onRequestChange: (event: 'INSERT' | 'UPDATE' | 'DELETE') => void;
  onFriendshipChange: (event: 'INSERT' | 'DELETE') => void;
};

export function subscribeToFriendEvents(
  handlers: FriendsRealtimeHandlers,
  channelName = 'friends',
): () => void {
  const channel = supabase
    .channel(uniqueChannelName(channelName))
    .on(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'postgres_changes' as any,
      { event: '*', schema: 'public', table: 'friend_requests' },
      (payload: { eventType: 'INSERT' | 'UPDATE' | 'DELETE' }) => {
        handlers.onRequestChange(payload.eventType);
      },
    )
    .on(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'postgres_changes' as any,
      { event: '*', schema: 'public', table: 'friendships' },
      (payload: { eventType: 'INSERT' | 'UPDATE' | 'DELETE' }) => {
        if (payload.eventType !== 'UPDATE') {
          handlers.onFriendshipChange(payload.eventType);
        }
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ─── Pure helpers ──────────────────────────────────────────────────────────

export function canonicalA(u1: string, u2: string): string {
  return u1 < u2 ? u1 : u2;
}

export function canonicalB(u1: string, u2: string): string {
  return u1 < u2 ? u2 : u1;
}

export function mergeFriendsPages(
  existing: FriendProfile[],
  next: FriendProfile[],
): FriendProfile[] {
  const byId = new Map<string, FriendProfile>();
  for (const p of existing) byId.set(p.id, p);
  for (const p of next) byId.set(p.id, p);
  return [...byId.values()].sort((a, b) => {
    if (a.handle !== b.handle) {
      return a.handle < b.handle ? -1 : 1;
    }
    return a.id < b.id ? -1 : 1;
  });
}

export function mergeRequestPages(
  existing: FriendRequest[],
  next: FriendRequest[],
): FriendRequest[] {
  const byId = new Map<string, FriendRequest>();
  for (const r of existing) byId.set(r.id, r);
  for (const r of next) byId.set(r.id, r);
  return [...byId.values()].sort((a, b) => {
    if (a.created_at !== b.created_at) {
      return a.created_at < b.created_at ? 1 : -1;
    }
    return a.id < b.id ? 1 : -1;
  });
}

// ─── Internal ──────────────────────────────────────────────────────────────

function mapRequestRows(rows: unknown[]): FriendRequest[] {
  return (
    rows as Array<{
      id: string;
      from_user: string;
      to_user: string;
      status: 'pending' | 'accepted' | 'declined';
      created_at: string;
      responded_at: string | null;
      profile_id: string;
      handle: string;
      avatar_url: string | null;
    }>
  ).map((r) => ({
    id: r.id,
    from_user: r.from_user,
    to_user: r.to_user,
    status: r.status,
    created_at: r.created_at,
    responded_at: r.responded_at,
    profile: {
      id: r.profile_id,
      handle: r.handle,
      avatar_url: r.avatar_url,
    },
  }));
}
