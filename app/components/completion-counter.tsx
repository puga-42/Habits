import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Palette } from '@/constants/colors';
import type { Habit } from '@/lib/habits';

type Props = {
  habit: Habit;
  completionCount: number;
  onIncrement: () => void;
  onDecrement: () => void;
  disabled: boolean;
  busy: boolean;
};

export function CompletionCounter({
  habit,
  completionCount,
  onIncrement,
  onDecrement,
  disabled,
  busy,
}: Props) {
  const color = habit.color ?? Palette.primary;

  if (habit.kind === 'scheduled') {
    return (
      <ScheduledCounter
        completed={completionCount > 0}
        color={color}
        onToggle={completionCount > 0 ? onDecrement : onIncrement}
        disabled={disabled || busy}
      />
    );
  }

  const target = habit.target_count ?? 1;
  return (
    <FlexCounter
      count={completionCount}
      target={target}
      color={color}
      onIncrement={onIncrement}
      onDecrement={onDecrement}
      disabled={disabled || busy}
    />
  );
}

function ScheduledCounter({
  completed,
  color,
  onToggle,
  disabled,
}: {
  completed: boolean;
  color: string;
  onToggle: () => void;
  disabled: boolean;
}) {
  return (
    <View style={styles.container}>
      <Pressable
        onPress={onToggle}
        disabled={disabled}
        style={({ pressed }) => [
          styles.scheduledCircle,
          completed
            ? { backgroundColor: color }
            : { borderColor: color, borderWidth: 2.5 },
          pressed && styles.pressed,
          disabled && styles.disabledBtn,
        ]}
        hitSlop={8}
      >
        {completed && <ThemedText style={styles.checkmark}>✓</ThemedText>}
      </Pressable>
      <ThemedText style={styles.statusLabel}>
        {completed ? 'Completed' : 'Tap to complete'}
      </ThemedText>
    </View>
  );
}

function FlexCounter({
  count,
  target,
  color,
  onIncrement,
  onDecrement,
  disabled,
}: {
  count: number;
  target: number;
  color: string;
  onIncrement: () => void;
  onDecrement: () => void;
  disabled: boolean;
}) {
  return (
    <View style={styles.container}>
      <View style={styles.flexRow}>
        <Pressable
          onPress={onDecrement}
          disabled={disabled || count === 0}
          style={({ pressed }) => [
            styles.flexButton,
            pressed && styles.pressed,
            (disabled || count === 0) && styles.disabledBtn,
          ]}
          hitSlop={8}
        >
          <ThemedText style={styles.flexButtonText}>−</ThemedText>
        </Pressable>

        <View style={styles.flexCount}>
          <ThemedText style={[styles.countText, { color }]}>
            {count}
          </ThemedText>
          <ThemedText style={styles.targetText}>/ {target}</ThemedText>
        </View>

        <Pressable
          onPress={onIncrement}
          disabled={disabled}
          style={({ pressed }) => [
            styles.flexButton,
            pressed && styles.pressed,
            disabled && styles.disabledBtn,
          ]}
          hitSlop={8}
        >
          <ThemedText style={styles.flexButtonText}>+</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 20 },
  scheduledCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: { color: '#fff', fontSize: 26, fontWeight: '700' },
  statusLabel: { fontSize: 13, opacity: 0.6, marginTop: 8 },
  flexRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  flexButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(127,127,127,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flexButtonText: { fontSize: 24, fontWeight: '600' },
  flexCount: { flexDirection: 'row', alignItems: 'baseline', gap: 4, minHeight: 48 },
  countText: { fontSize: 36, lineHeight: 44, fontWeight: '700' },
  targetText: { fontSize: 18, opacity: 0.5 },
  pressed: { opacity: 0.5 },
  disabledBtn: { opacity: 0.3 },
});
