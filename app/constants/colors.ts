export const Palette = {
  primary: '#09EDE2',
  primaryDark: '#089E9A',
  primaryLight: '#A8E4E1',

  lavender: '#A78BFA',
  lavenderMuted: '#474164',
  blush: '#FCA5A5',
  blushMuted: '#5A4752',

  charcoal: '#2C2C3A',
  charcoalElevated: '#363647',
  ghostWhite: '#F8FAFC',

  coolGray: '#94A3B8',
  slate200: '#E2E8F0',

  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',

  habitColors: [
    '#0ABAB5',
    '#A78BFA',
    '#10B981',
    '#F59E0B',
    '#FCA5A5',
    '#3B82F6',
    '#94A3B8',
  ],
} as const;

export function primaryRgba(alpha: number): string {
  return `rgba(10,186,181,${alpha})`;
}

/** Blend `hex` toward the theme background at `amount` (0–1), returning a solid hex color. */
export function solidTint(hex: string, amount: number, isDark = true): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const [bgR, bgG, bgB] = isDark ? [44, 44, 58] : [248, 250, 252];
  const outR = Math.round(bgR + amount * (r - bgR));
  const outG = Math.round(bgG + amount * (g - bgG));
  const outB = Math.round(bgB + amount * (b - bgB));
  return `#${outR.toString(16).padStart(2, '0')}${outG.toString(16).padStart(2, '0')}${outB.toString(16).padStart(2, '0')}`;
}
