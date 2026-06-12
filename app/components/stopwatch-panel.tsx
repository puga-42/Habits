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
  const stopSize = Math.round(ringSize * 0.2);
  const playSize = Math.round(ringSize * 0.32);
  const isComplete = sw.status === 'complete';

  const handleRingPress = () => {
    if (sw.status === 'idle') sw.start();
    else if (sw.status === 'running') sw.stop();
  };

  return (
    <View style={styles.container} onLayout={handleLayout}>
      {containerWidth > 0 && (
        <Pressable
          onPress={handleRingPress}
          disabled={isComplete}
          style={({ pressed }) => pressed && !isComplete && styles.pressed}
        >
          <ProgressRing
            size={ringSize}
            strokeWidth={8}
            fraction={sw.progressFraction}
            color={color}
            trackColor="rgba(127,127,127,0.2)">
            {isComplete ? (
              <ThemedText style={[styles.ringCheck, { color, fontSize: Math.round(ringSize * 0.3) }]}>✓</ThemedText>
            ) : sw.status === 'running' ? (
              <View style={[styles.stopIcon, { width: stopSize, height: stopSize, backgroundColor: color }]} />
            ) : (
              <ThemedText style={[styles.playIcon, { color, fontSize: playSize, lineHeight: playSize }]}>▶</ThemedText>
            )}
          </ProgressRing>
        </Pressable>
      )}

      <ThemedText style={styles.elapsed}>
        {formatElapsed(sw.totalSeconds, displayUnit)}
      </ThemedText>

      <ThemedText style={styles.target}>
        {sw.totalSeconds > 0 ? `${formatElapsed(sw.totalSeconds, displayUnit)} / ` : ''}
        {formatTarget(sw.targetSeconds, displayUnit)}
      </ThemedText>
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
  ringCheck: { lineHeight: 34, fontWeight: '700', marginTop: 2 },
  playIcon: { marginLeft: 5, marginTop: 4, includeFontPadding: false },
  stopIcon: { borderRadius: 2 },
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
  pressed: { opacity: 0.6 },
});
