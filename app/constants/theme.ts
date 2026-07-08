/**
 * Ember semantic tokens (UI overhaul slice 1 — see PLAN.md "UI overhaul").
 * Components read these via useTokens() / useThemeColor() and stop knowing
 * hex codes. Text hierarchy and hairlines are alphas of the scheme's ink, so
 * every "gray" is warm and related to its ground — the old dead
 * rgba(127,127,127,·) is banned (guarded by constants/__tests__).
 */

import { Platform } from 'react-native';

import { Ember, Palette } from '@/constants/colors';

export const Tokens = {
  light: {
    bg: Ember.paper,
    surface: Ember.paperSurface,
    surfaceRaised: Ember.paperRaised,
    ink: Ember.inkLight,
    ink70: 'rgba(42,36,40,0.70)',
    ink52: 'rgba(42,36,40,0.52)',
    ink45: 'rgba(42,36,40,0.45)',
    hairline: 'rgba(42,36,40,0.10)',
    hairlineStrong: 'rgba(42,36,40,0.14)',
    accent: Ember.coralDeep,
    onAccent: '#FFF7F2',
    accentSoft: 'rgba(184,74,34,0.12)',
    streak: '#946708',
    streakSoft: 'rgba(148,103,8,0.14)',
    success: '#2A7C4D',
    successSoft: 'rgba(42,124,77,0.14)',
    danger: '#BE3A2D',
    today: Palette.periwinkleDeep,
  },
  dark: {
    bg: Ember.plum,
    surface: Ember.plumSurface,
    surfaceRaised: Ember.plumRaised,
    ink: Ember.ink,
    ink70: 'rgba(244,239,234,0.70)',
    ink52: 'rgba(244,239,234,0.52)',
    ink45: 'rgba(244,239,234,0.45)',
    hairline: 'rgba(244,239,234,0.08)',
    hairlineStrong: 'rgba(244,239,234,0.12)',
    accent: Ember.coral,
    onAccent: Ember.onCoral,
    accentSoft: 'rgba(255,142,98,0.16)',
    streak: Ember.honey,
    streakSoft: 'rgba(255,194,75,0.14)',
    success: Ember.leaf,
    successSoft: 'rgba(99,197,138,0.16)',
    danger: Ember.flame,
    today: Palette.periwinkle,
  },
} as const;

export type ThemeTokens = { [K in keyof typeof Tokens.dark]: string };

// Friendly-shape radii: cards are soft, controls slightly tighter.
export const Radii = {
  card: 20,
  control: 12,
} as const;

// Legacy theme map — kept for useThemeColor and the tab bar; values now derive
// from the tokens so there is one source of truth.
export const Colors = {
  light: {
    text: Tokens.light.ink,
    background: Tokens.light.bg,
    tint: Tokens.light.accent,
    icon: Tokens.light.ink52,
    tabIconDefault: Tokens.light.ink52,
    tabIconSelected: Tokens.light.accent,
  },
  dark: {
    text: Tokens.dark.ink,
    background: Tokens.dark.bg,
    tint: Tokens.dark.accent,
    icon: Tokens.dark.ink52,
    tabIconDefault: Tokens.dark.ink52,
    tabIconSelected: Tokens.dark.accent,
  },
};

export const TRAILING_ICON_SIZE = 18;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
