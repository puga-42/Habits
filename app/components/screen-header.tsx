// Elevated top-bar surface shared by every tab screen: fills behind the status
// bar (safe-area top inset), sits on a slightly raised surface against the page
// background, and is capped by a hairline divider — so the header reads as a
// distinct band from the content scrolling beneath it. Wrap a screen's TabTopBar
// (and, on the calendar, the date chrome) in this.

import type { ReactNode } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Palette } from '@/constants/colors';

export function ScreenHeader({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() !== 'light';
  return (
    <View
      style={[
        styles.header,
        { paddingTop: insets.top, backgroundColor: isDark ? Palette.charcoalElevated : '#FFFFFF' },
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(127,127,127,0.25)',
  },
});
