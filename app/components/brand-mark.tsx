// PLACEHOLDER brand lockup — "Catherine's Habits" pending a real name/logo.
// This component is the single point of replacement when branding lands:
// swap the monogram circle for the logo asset and update the wordmark here,
// and every surface that renders <BrandMark> follows. (The native splash
// image in app.json must be swapped alongside — it can't render RN views.)

import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';

type Props = {
  // Diameter of the monogram circle; type scales with it.
  size?: number;
  showWordmark?: boolean;
};

export function BrandMark({ size = 72, showWordmark = true }: Props) {
  const t = useTokens();
  return (
    <View style={styles.root}>
      <View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: t.accent,
            shadowColor: t.accent,
          },
        ]}
        accessibilityElementsHidden>
        <ThemedText
          style={[styles.monogram, { color: t.onAccent, fontSize: size * 0.5 }]}
          allowFontScaling={false}>
          C
        </ThemedText>
      </View>
      {showWordmark ? (
        <ThemedText type="display" style={styles.wordmark}>
          Catherine&apos;s Habits
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', gap: 16 },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  monogram: {
    fontFamily: Fonts?.rounded,
    fontWeight: '800',
    // Keep the glyph optically centered in the circle.
    lineHeight: undefined,
  },
  wordmark: { textAlign: 'center' },
});
