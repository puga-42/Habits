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

  useEffect(() => {
    if (!userId) return;
    refresh();
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
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
