import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/lib/auth';
import { applyThemePreference, loadThemePreference } from '@/lib/theme-preference';
import { syncWidgetData } from '@/lib/widget-sync';

export const unstable_settings = {
  anchor: '(tabs)',
};

function AuthGate() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;
    const inSignIn = segments[0] === 'sign-in';
    if (!session && !inSignIn) {
      router.replace('/sign-in');
    } else if (session && inSignIn) {
      router.replace('/(tabs)');
    }
  }, [session, loading, segments, router]);

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) return;
    syncWidgetData(userId);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncWidgetData(userId);
    });
    return () => sub.remove();
  }, [session?.user.id]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="sign-in" />
      {/* Full pages, not modals: create/edit/overview (and their detail pages
          goal/repeat/visibility/color) push like everything else. */}
      <Stack.Screen name="habit" />
      <Stack.Screen name="completion" />
      <Stack.Screen name="likers" />
      <Stack.Screen name="user" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="groups" />
      <Stack.Screen name="feedback" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  // Re-apply the persisted Appearance override (Settings → Appearance) on
  // launch; useColorScheme everywhere then reflects it automatically.
  useEffect(() => {
    loadThemePreference().then(applyThemePreference);
  }, []);

  return (
    // GestureHandlerRootView is required by react-native-draggable-flatlist
    // (and any other gesture-handler-based lib). expo-router does not wrap
    // the app automatically, so we do it here.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AuthProvider>
          <AuthGate />
          <StatusBar style="auto" />
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
