import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { fetchUnreadCount } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { uniqueChannelName } from '@/lib/realtime-channel-name';

type UnreadCountContextValue = {
  unreadCount: number;
  refreshUnreadCount: () => void;
};

const UnreadCountContext = createContext<UnreadCountContextValue | null>(null);

export function UnreadCountProvider({
  userId,
  children,
}: {
  userId: string | null;
  children: ReactNode;
}) {
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(() => {
    if (!userId) return;
    fetchUnreadCount().then(setUnreadCount).catch(() => {});
  }, [userId]);

  // Refresh from a Realtime subscription on this user's notifications instead
  // of polling — new rows (from the enqueue triggers) update the badge live.
  useEffect(() => {
    if (!userId) return;
    refresh();
    const channel = supabase
      .channel(uniqueChannelName(`unread-notifications:${userId}`))
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, refresh]);

  const value = useMemo<UnreadCountContextValue>(
    () => ({ unreadCount, refreshUnreadCount: refresh }),
    [unreadCount, refresh],
  );

  return (
    <UnreadCountContext.Provider value={value}>
      {children}
    </UnreadCountContext.Provider>
  );
}

export function useUnreadCount(): UnreadCountContextValue {
  const ctx = useContext(UnreadCountContext);
  if (!ctx)
    throw new Error('useUnreadCount must be used within UnreadCountProvider');
  return ctx;
}
