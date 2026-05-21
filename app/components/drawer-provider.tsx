import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import type { ViewMode } from '@/components/calendar-menu-drawer';

type DrawerContextValue = {
  menuOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  view: ViewMode;
  setView: (v: ViewMode) => void;
};

const DrawerContext = createContext<DrawerContextValue | null>(null);

export function DrawerProvider({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [view, setView] = useState<ViewMode>('day');

  const value = useMemo<DrawerContextValue>(
    () => ({
      menuOpen,
      openDrawer: () => setMenuOpen(true),
      closeDrawer: () => setMenuOpen(false),
      view,
      setView,
    }),
    [menuOpen, view],
  );

  return <DrawerContext.Provider value={value}>{children}</DrawerContext.Provider>;
}

export function useDrawer(): DrawerContextValue {
  const ctx = useContext(DrawerContext);
  if (!ctx) throw new Error('useDrawer must be used within DrawerProvider');
  return ctx;
}
