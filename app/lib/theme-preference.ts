// In-app appearance override (Settings → Appearance): System / Light / Dark.
// The choice persists in AsyncStorage and applies app-wide through RN's
// Appearance.setColorScheme — useColorScheme (and therefore useTokens, the
// navigation theme, and the status bar) all follow it, so no component needs
// to know an override exists. 'system' clears the override and follows the
// device. Pure helpers are TDD'd in __tests__/theme-preference.test.ts.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';

const STORAGE_KEY = 'theme-preference';

export type ThemePreference = 'system' | 'light' | 'dark';

// What Appearance.setColorScheme expects: null means "no override".
export function toAppearanceScheme(
  pref: ThemePreference,
): 'light' | 'dark' | null {
  return pref === 'system' ? null : pref;
}

// Guards values read back from storage (or any unknown input).
export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function applyThemePreference(pref: ThemePreference): void {
  Appearance.setColorScheme(toAppearanceScheme(pref));
}

export async function loadThemePreference(): Promise<ThemePreference> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return isThemePreference(raw) ? raw : 'system';
  } catch {
    return 'system'; // unreadable storage falls back to the device setting
  }
}

export async function saveThemePreference(pref: ThemePreference): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, pref);
  } catch {
    // Best-effort: the override is applied for this session either way.
  }
}
