import { StyleSheet, View } from 'react-native';

import { AnimatedProgressRing } from '@/components/animated-progress-ring';
import { ThemedText } from '@/components/themed-text';
import { TRAILING_ICON_SIZE } from '@/constants/theme';

export type TimerStatus = 'idle' | 'running' | 'complete';

const RING_STROKE = 3;
const RING_SIZE = TRAILING_ICON_SIZE + RING_STROKE * 2 + 8;
const STOP_SIZE = TRAILING_ICON_SIZE * 0.45;

type Props = {
  status: TimerStatus;
  color: string;
  fraction?: number;
};

export function TimeTrailingIcon({ status, color, fraction = 0 }: Props) {
  if (status === 'complete') {
    return <ThemedText style={[styles.iconBold, { color }]}>✓</ThemedText>;
  }

  return (
    <AnimatedProgressRing size={RING_SIZE} strokeWidth={RING_STROKE} fraction={fraction} color={color}>
      {status === 'running' ? (
        <View style={[styles.stopIcon, { backgroundColor: color }]} />
      ) : (
        <ThemedText style={[styles.icon, { color }]}>▶</ThemedText>
      )}
    </AnimatedProgressRing>
  );
}

const styles = StyleSheet.create({
  icon: { fontSize: TRAILING_ICON_SIZE, marginLeft: 2 },
  iconBold: { fontSize: TRAILING_ICON_SIZE, fontWeight: '700' },
  stopIcon: {
    width: STOP_SIZE,
    height: STOP_SIZE,
    borderRadius: 1.5,
  },
});
