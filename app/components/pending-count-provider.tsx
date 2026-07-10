import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { fetchPendingRequestCount } from '@/lib/friends';
import { supabase } from '@/lib/supabase';
import { uniqueChannelName } from '@/lib/realtime-channel-name';

type PendingCountContextValue = {
  pendingCount: number;
  refreshPendingCount: () => void;
};

const PendingCountContext = createContext<PendingCountContextValue | null>(null);

export function PendingCountProvider({
  userId,
  children,
}: {
  userId: string | null;
  children: ReactNode;
}) {
  const [pendingCount, setPendingCount] = useState(0);

  const refresh = useCallback(() => {
    if (!userId) return;
    fetchPendingRequestCount(userId).then(setPendingCount).catch(() => {});
  }, [userId]);

  // Refresh from Realtime on incoming friend requests instead of polling.
  useEffect(() => {
    if (!userId) return;
    refresh();
    const channel = supabase
      .channel(uniqueChannelName(`pending-requests:${userId}`))
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'friend_requests', filter: `to_user=eq.${userId}` },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, refresh]);

  const value = useMemo<PendingCountContextValue>(
    () => ({ pendingCount, refreshPendingCount: refresh }),
    [pendingCount, refresh],
  );

  return (
    <PendingCountContext.Provider value={value}>
      {children}
    </PendingCountContext.Provider>
  );
}

export function usePendingCount(): PendingCountContextValue {
  const ctx = useContext(PendingCountContext);
  if (!ctx)
    throw new Error(
      'usePendingCount must be used within PendingCountProvider',
    );
  return ctx;
}
