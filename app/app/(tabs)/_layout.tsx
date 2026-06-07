import { useRouter, Tabs } from 'expo-router';
import React from 'react';

import { CalendarMenuDrawer } from '@/components/calendar-menu-drawer';
import { DrawerProvider, useDrawer } from '@/components/drawer-provider';
import { HapticTab } from '@/components/haptic-tab';
import { PendingCountProvider, usePendingCount } from '@/components/pending-count-provider';
import { UnreadCountProvider, useUnreadCount } from '@/components/unread-count-provider';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Palette } from '@/constants/colors';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/lib/auth';

const AVAILABLE_VIEWS = ['day', '3day', 'week', 'month'] as const;

export default function TabLayout() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  return (
    <DrawerProvider>
      <PendingCountProvider userId={userId}>
        <UnreadCountProvider userId={userId}>
          <TabLayoutInner />
        </UnreadCountProvider>
      </PendingCountProvider>
    </DrawerProvider>
  );
}

function TabLayoutInner() {
  const colorScheme = useColorScheme();
  const tint = Colors[colorScheme ?? 'light'].tint;
  const router = useRouter();
  const { pendingCount } = usePendingCount();
  const { unreadCount } = useUnreadCount();
  const { menuOpen, closeDrawer, view, setView } = useDrawer();

  return (
    <>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: tint,
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarStyle: {
            backgroundColor: colorScheme === 'dark' ? Palette.charcoalElevated : Palette.ghostWhite,
            borderTopColor: colorScheme === 'dark'
              ? 'rgba(255,255,255,0.08)'
              : Palette.slate200,
          },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Calendar',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="calendar" color={color} />,
          }}
        />
        <Tabs.Screen
          name="feed"
          options={{
            title: 'Feed',
            tabBarIcon: ({ color }) => (
              <IconSymbol size={28} name="rectangle.stack.fill" color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="friends"
          options={{
            title: 'Friends',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.2.fill" color={color} />,
            tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
          }}
        />
        <Tabs.Screen
          name="notifications"
          options={{
            title: 'Notifications',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="bell.fill" color={color} />,
            tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          }}
        />
        <Tabs.Screen
          name="me"
          options={{
            title: 'Me',
            tabBarIcon: ({ color }) => (
              <IconSymbol size={28} name="person.crop.circle.fill" color={color} />
            ),
          }}
        />
      </Tabs>

      <CalendarMenuDrawer
        visible={menuOpen}
        view={view}
        available={[...AVAILABLE_VIEWS]}
        onPickView={setView}
        onOpenSettings={() => router.push('/settings')}
        onClose={closeDrawer}
      />
    </>
  );
}
