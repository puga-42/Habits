import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// In dev with a local Supabase stack, derive the host from whatever IP Metro
// is reachable at (works for simulator → 127.0.0.1 and physical device → LAN
// IP, automatically). In production, EXPO_PUBLIC_SUPABASE_URL is set to the
// hosted Supabase project URL and takes precedence.
function resolveSupabaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (fromEnv) return fromEnv;
  const metroHost = Constants.expoConfig?.hostUri?.split(':')[0];
  return metroHost ? `http://${metroHost}:54321` : '';
}

const supabaseUrl = resolveSupabaseUrl();
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase not fully configured. ' +
      'In dev, ensure Metro is running and `supabase start` is up. ' +
      'In prod, set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
