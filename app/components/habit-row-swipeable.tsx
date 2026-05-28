import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  interpolate,
} from 'react-native-reanimated';

import { AgendaRow } from '@/components/agenda-row';
import { ThemedText } from '@/components/themed-text';
import type { AgendaRow as AgendaRowT, SwipeAction } from '@/lib/history';
import { swipeActionsForRow } from '@/lib/history';

const CHIP_WIDTH = 72;
const CHIP_GAP = 6;
const DRAWER_LEFT_PAD = 10;

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduced,
    );
    return () => sub.remove();
  }, []);
  return reduced;
}

type Props = {
  row: AgendaRowT;
  dateIso: string;
  onPress?: () => void;
  onTrailingPress: () => void;
  onSwipeAction: (action: SwipeAction) => void;
  onDrawerOpen?: (closeFn: () => void) => void;
  onDrawerClose?: () => void;
  onLongPress?: () => void;
  flexProgress?: { count: number; target: number };
  compact?: boolean | 'tight';
  isActive?: boolean;
};

export function HabitRowSwipeable({
  row,
  onPress,
  onTrailingPress,
  onSwipeAction,
  onDrawerOpen,
  onDrawerClose,
  onLongPress,
  flexProgress,
  compact,
  isActive,
}: Props) {
  const swipeRef = useRef<SwipeableMethods>(null);
  const reducedMotion = useReducedMotion();
  const actions = swipeActionsForRow(row);

  const handleAction = useCallback(
    (action: SwipeAction) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      swipeRef.current?.close();
      onSwipeAction(action);
    },
    [onSwipeAction],
  );

  const handleOpen = useCallback(() => {
    onDrawerOpen?.(() => swipeRef.current?.close());
  }, [onDrawerOpen]);

  const handleClose = useCallback(() => {
    onDrawerClose?.();
  }, [onDrawerClose]);

  if (actions.length === 0) {
    return (
      <AgendaRow
        row={row}
        onPress={onPress}
        onTrailingPress={onTrailingPress}
        onLongPress={onLongPress}
        flexProgress={flexProgress}
        compact={compact}
        isActive={isActive}
      />
    );
  }

  const drawerWidth = actions.length * CHIP_WIDTH + (actions.length - 1) * CHIP_GAP + DRAWER_LEFT_PAD;

  const renderRightActions = (
    progress: SharedValue<number>,
    translation: SharedValue<number>,
  ) => (
    <ActionChips
      actions={actions}
      drawerWidth={drawerWidth}
      progress={progress}
      reducedMotion={reducedMotion}
      onAction={handleAction}
    />
  );

  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      renderRightActions={renderRightActions}
      rightThreshold={drawerWidth * 0.4}
      overshootRight={false}
      overshootFriction={8}
      onSwipeableOpen={handleOpen}
      onSwipeableClose={handleClose}
    >
      <AgendaRow
        row={row}
        onPress={onPress}
        onTrailingPress={onTrailingPress}
        onLongPress={onLongPress}
        flexProgress={flexProgress}
        compact={compact}
        isActive={isActive}
      />
    </ReanimatedSwipeable>
  );
}

const CHIP_COLORS: Record<SwipeAction, { bg: string; text: string }> = {
  reset: { bg: 'rgba(127,127,127,0.18)', text: undefined as any },
  skip: { bg: '#E0A526', text: '#fff' },
};

const CHIP_LABELS: Record<SwipeAction, string> = {
  reset: 'Reset',
  skip: 'Skip',
};

function ActionChips({
  actions,
  drawerWidth,
  progress,
  reducedMotion,
  onAction,
}: {
  actions: SwipeAction[];
  drawerWidth: number;
  progress: SharedValue<number>;
  reducedMotion: boolean;
  onAction: (action: SwipeAction) => void;
}) {
  return (
    <View style={[styles.drawerContainer, { width: drawerWidth }]}>
      {actions.map((action, i) => (
        <AnimatedChip
          key={action}
          action={action}
          index={i}
          total={actions.length}
          progress={progress}
          reducedMotion={reducedMotion}
          onPress={() => onAction(action)}
        />
      ))}
    </View>
  );
}

function AnimatedChip({
  action,
  index,
  total,
  progress,
  reducedMotion,
  onPress,
}: {
  action: SwipeAction;
  index: number;
  total: number;
  progress: SharedValue<number>;
  reducedMotion: boolean;
  onPress: () => void;
}) {
  const animStyle = useAnimatedStyle(() => {
    if (reducedMotion) {
      return { opacity: progress.value > 0.1 ? 1 : 0 };
    }
    const stagger = (total - index) / total;
    return {
      opacity: interpolate(progress.value, [0, 0.3 * stagger, 1], [0, 0, 1]),
      transform: [
        {
          translateX: interpolate(
            progress.value,
            [0, 0.5, 1],
            [CHIP_WIDTH * 0.5, CHIP_WIDTH * 0.15, 0],
          ),
        },
      ],
    };
  });

  const colors = CHIP_COLORS[action];

  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.chip,
          { backgroundColor: colors.bg },
          pressed && styles.chipPressed,
        ]}>
        <ThemedText
          style={[
            styles.chipLabel,
            colors.text ? { color: colors.text } : null,
          ]}>
          {CHIP_LABELS[action]}
        </ThemedText>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  drawerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: CHIP_GAP,
    paddingLeft: 10,
  },
  chip: {
    width: CHIP_WIDTH,
    height: '100%',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipPressed: { opacity: 0.6 },
  chipLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
});
