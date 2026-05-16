import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';

const DISPLAY_DURATION_MS = 4000;
const FADE_DURATION_MS = 300;

type Props = {
  visible: boolean;
  onPress: () => void;
  onDismiss: () => void;
};

export function CompletionToast({ visible, onPress, onDismiss }: Props) {
  const opacity = useSharedValue(0);
  const colorScheme = useColorScheme();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: FADE_DURATION_MS });
      timerRef.current = setTimeout(() => {
        opacity.value = withTiming(0, { duration: FADE_DURATION_MS }, () => {
          runOnJS(onDismiss)();
        });
      }, DISPLAY_DURATION_MS);
    } else {
      opacity.value = withTiming(0, { duration: FADE_DURATION_MS });
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    pointerEvents: opacity.value > 0.1 ? 'auto' : 'none',
  }));

  const bgColor =
    colorScheme === 'dark' ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)';
  const textColor = colorScheme === 'dark' ? '#000' : '#fff';

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <Pressable
        onPress={() => {
          if (timerRef.current) clearTimeout(timerRef.current);
          onPress();
          onDismiss();
        }}
        style={[styles.pill, { backgroundColor: bgColor }]}
      >
        <ThemedText style={[styles.icon]}>📷</ThemedText>
        <ThemedText style={[styles.text, { color: textColor }]}>
          Add a note or photo?
        </ThemedText>
        <ThemedText style={[styles.chevron, { color: textColor }]}>›</ThemedText>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 90,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 22,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  icon: { fontSize: 16 },
  text: { fontSize: 14, fontWeight: '600', flex: 1 },
  chevron: { fontSize: 20, fontWeight: '600' },
});
