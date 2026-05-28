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

const POLL_MS = 30_000;

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

  useEffect(() => {
    if (!userId) return;
    refresh();
    const interval = setInterval(refresh, POLL_MS);
    return () => clearInterval(interval);
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
