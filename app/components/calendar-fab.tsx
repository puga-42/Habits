import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTokens } from '@/hooks/use-tokens';

type Props = {
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

export function CalendarFAB({ onPress, style }: Props) {
  const t = useTokens();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.fab,
        // Ember accent with a soft coral glow instead of a plain black drop
        // shadow — the FAB is the day view's one bold moment.
        { backgroundColor: t.accent, shadowColor: t.accent },
        pressed && styles.fabPressed,
        style,
      ]}>
      <ThemedText style={[styles.plus, { color: t.onAccent }]}>+</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  fabPressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  plus: { fontSize: 30, lineHeight: 32, fontWeight: '400' },
});
