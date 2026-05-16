import { type ReactNode, useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type FabAction = {
  key: string;
  label: string;
  icon: ReactNode;
  onPress: () => void;
};

type Props = {
  actions: FabAction[];
};

const ITEM_HEIGHT = 48;
const ITEM_GAP = 12;
const FAB_SIZE = 56;
const FAB_BOTTOM = 24;
const FAB_RIGHT = 24;

export function FabSpeedDial({ actions }: Props) {
  const [expanded, setExpanded] = useState(false);
  const rotation = useSharedValue(0);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const toggle = useCallback(() => {
    setExpanded((prev) => {
      const next = !prev;
      rotation.value = withSpring(next ? 45 : 0, { damping: 12, stiffness: 180 });
      return next;
    });
  }, [rotation]);

  const collapse = useCallback(() => {
    setExpanded(false);
    rotation.value = withSpring(0, { damping: 12, stiffness: 180 });
  }, [rotation]);

  const fabAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View style={styles.container} pointerEvents="box-none">
      {expanded && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={styles.backdropWrapper}
        >
          <Pressable style={styles.backdrop} onPress={collapse} />
        </Animated.View>
      )}

      {expanded &&
        actions.map((action, index) => (
          <ActionItem
            key={action.key}
            action={action}
            index={index}
            isDark={isDark}
            onPress={() => {
              action.onPress();
              collapse();
            }}
          />
        ))}

      <Pressable
        onPress={toggle}
        hitSlop={8}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      >
        <Animated.View style={fabAnimatedStyle}>
          <ThemedText style={styles.plus}>+</ThemedText>
        </Animated.View>
      </Pressable>
    </View>
  );
}

function ActionItem({
  action,
  index,
  isDark,
  onPress,
}: {
  action: FabAction;
  index: number;
  isDark: boolean;
  onPress: () => void;
}) {
  const bottomOffset = FAB_BOTTOM + FAB_SIZE + ITEM_GAP + index * (ITEM_HEIGHT + ITEM_GAP);
  const translateY = useSharedValue(40);
  const opacity = useSharedValue(0);

  translateY.value = withSpring(0, { damping: 14, stiffness: 160 });
  opacity.value = withTiming(1, { duration: 200 });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.actionRow,
        { bottom: bottomOffset, backgroundColor: isDark ? '#1c1c1e' : '#fff' },
        animatedStyle,
      ]}
    >
      <Pressable
        style={styles.actionPressable}
        onPress={onPress}
        hitSlop={4}
      >
        {action.icon}
        <ThemedText style={styles.actionLabel}>{action.label}</ThemedText>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  backdropWrapper: {
    ...StyleSheet.absoluteFillObject,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  fab: {
    position: 'absolute',
    bottom: FAB_BOTTOM,
    right: FAB_RIGHT,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabPressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  plus: { color: '#fff', fontSize: 30, lineHeight: 32, fontWeight: '300' },
  actionRow: {
    position: 'absolute',
    right: FAB_RIGHT,
    height: ITEM_HEIGHT,
    borderRadius: ITEM_HEIGHT / 2,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  actionPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
});
