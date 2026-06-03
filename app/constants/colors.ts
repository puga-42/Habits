export const Palette = {
  primary: '#09EDE2',
  primaryDark: '#08C9C0',
  primaryLight: '#B2F0EB',

  lavender: '#A78BFA',
  blush: '#FCA5A5',

  charcoal: '#2C2C3A',
  charcoalElevated: '#363647',
  ghostWhite: '#F8FAFC',

  coolGray: '#94A3B8',
  slate200: '#E2E8F0',

  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',

  habitColors: [
    '#09EDE2',
    '#A78BFA',
    '#10B981',
    '#F59E0B',
    '#FCA5A5',
    '#3B82F6',
    '#94A3B8',
  ],
} as const;

export function primaryRgba(alpha: number): string {
  return `rgba(9,237,226,${alpha})`;
}
