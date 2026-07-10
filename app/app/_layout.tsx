import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
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

// Hold the native splash until the app knows where it's going (theme applied
// + auth session restored), then fade it directly into content — no
// white-flash → blank-gate → content sequence on cold start. The splash is a
// LAUNCH curtain only; mid-session loads use inline indicators, never this.
SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ fade: true, duration: 250 });

function AuthGate({ themeReady }: { themeReady: boolean }) {
  const { session, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  // Drop the splash curtain the moment the routing decision is possible: the
  // theme override has applied and the session restore has resolved.
  useEffect(() => {
    if (!loading && themeReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [loading, themeReady]);

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
  const [themeReady, setThemeReady] = useState(false);

  // Re-apply the persisted Appearance override (Settings → Appearance) on
  // launch; useColorScheme everywhere then reflects it automatically. The
  // splash stays up until this has applied (see AuthGate) so the first
  // painted frame is already in the right scheme.
  useEffect(() => {
    loadThemePreference()
      .then(applyThemePreference)
      .finally(() => setThemeReady(true));
  }, []);

  return (
    // GestureHandlerRootView is required by react-native-draggable-flatlist
    // (and any other gesture-handler-based lib). expo-router does not wrap
    // the app automatically, so we do it here.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AuthProvider>
          <AuthGate themeReady={themeReady} />
          <StatusBar style="auto" />
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
