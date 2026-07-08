// The Ember token hook — the one way components read theme colors going
// forward (UI overhaul slice 1). Returns the full semantic token set for the
// active scheme so a component makes one call, not one per color:
//
//   const t = useTokens();
//   <View style={{ backgroundColor: t.surface, borderColor: t.hairline }} />
//
// Falls back to 'light' when the scheme is unknown, matching useThemeColor.

import { Tokens, type ThemeTokens } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useTokens(): ThemeTokens {
  const scheme = useColorScheme() ?? 'light';
  return Tokens[scheme];
}
