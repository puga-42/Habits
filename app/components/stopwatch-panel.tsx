import { useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';

import { ProgressRing } from '@/components/progress-ring';
import { ThemedText } from '@/components/themed-text';
import { Palette } from '@/constants/colors';
import type { Habit } from '@/lib/habits';
import { formatElapsed, formatTarget } from '@/lib/time-format';
import { useStopwatch } from '@/lib/use-stopwatch';

type Props = {
  habit: Habit;
  userId: string;
  occurrenceDate: string | null;
  periodStart: string | null;
  isAlreadyComplete: boolean;
};

export function StopwatchPanel({
  habit,
  userId,
  occurrenceDate,
  periodStart,
  isAlreadyComplete,
}: Props) {
  const sw = useStopwatch(
    habit.id,
    userId,
    habit,
    occurrenceDate,
    periodStart,
    isAlreadyComplete,
  );

  const [containerWidth, setContainerWidth] = useState(0);
  const handleLayout = (e: LayoutChangeEvent) =>
    setContainerWidth(e.nativeEvent.layout.width);

  const displayUnit = habit.display_unit ?? 'minutes';
  const color = habit.color ?? Palette.primary;
  const ringSize = Math.round(containerWidth * 0.3);

  return (
    <View style={styles.container} onLayout={handleLayout}>
      {containerWidth > 0 && (
        <ProgressRing
          size={ringSize}
          strokeWidth={6}
          fraction={sw.progressFraction}
          color={color}
          trackColor="rgba(127,127,127,0.2)">
          {sw.progressFraction >= 1 && (
            <ThemedText style={[styles.ringCheck, { color }]}>✓</ThemedText>
          )}
        </ProgressRing>
      )}

      <ThemedText style={styles.elapsed}>
        {formatElapsed(sw.totalSeconds, displayUnit)}
      </ThemedText>

      <ThemedText style={styles.target}>
        {sw.totalSeconds > 0 ? `${formatElapsed(sw.totalSeconds, displayUnit)} / ` : ''}
        {formatTarget(sw.targetSeconds, displayUnit)}
      </ThemedText>

      {sw.status === 'complete' ? (
        <View style={[styles.button, styles.buttonComplete, { borderColor: color }]}>
          <ThemedText style={[styles.buttonText, { color }]}>Completed</ThemedText>
        </View>
      ) : sw.status === 'running' ? (
        <Pressable
          onPress={sw.stop}
          style={[styles.button, { backgroundColor: color }]}>
          <ThemedText style={styles.buttonTextLight}>Stop</ThemedText>
        </Pressable>
      ) : (
        <Pressable
          onPress={sw.start}
          style={[styles.button, { backgroundColor: color }]}>
          <ThemedText style={styles.buttonTextLight}>Start</ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 16,
    overflow: 'visible',
  },
  ringCheck: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  elapsed: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
  target: {
    fontSize: 14,
    opacity: 0.6,
  },
  button: {
    marginTop: 8,
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 28,
    alignItems: 'center',
  },
  buttonComplete: {
    backgroundColor: 'transparent',
    borderWidth: 2,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  buttonTextLight: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
