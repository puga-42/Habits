// Elevated top-bar surface shared by every tab screen: fills behind the status
// bar (safe-area top inset), sits on the token surface against the page
// background, and is capped by a warm hairline — so the header reads as a
// distinct band from the content scrolling beneath it. Wrap a screen's
// TabTopBar (and, on the calendar, the date chrome) in this.

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTokens } from '@/hooks/use-tokens';

export function ScreenHeader({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const t = useTokens();
  return (
    <View
      style={[
        styles.header,
        {
          paddingTop: insets.top,
          backgroundColor: t.surface,
          borderBottomColor: t.hairlineStrong,
        },
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
