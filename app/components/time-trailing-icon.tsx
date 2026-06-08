import { StyleSheet, View } from 'react-native';

import { ProgressRing } from '@/components/progress-ring';
import { ThemedText } from '@/components/themed-text';

export type TimerStatus = 'idle' | 'running' | 'complete';

type Props = {
  status: TimerStatus;
  color: string;
  fraction?: number;
};

export function TimeTrailingIcon({ status, color, fraction = 0 }: Props) {
  const showRing = status !== 'idle' || fraction > 0;

  if (!showRing) {
    return <ThemedText style={[styles.playLarge, { color }]}>▶</ThemedText>;
  }

  const f = status === 'complete' ? 1 : fraction;

  return (
    <ProgressRing size={22} strokeWidth={2.5} fraction={f} color={color}>
      {status === 'complete' ? (
        <ThemedText style={[styles.check, { color }]}>✓</ThemedText>
      ) : status === 'running' ? (
        <View style={[styles.stopIcon, { backgroundColor: color }]} />
      ) : (
        <ThemedText style={[styles.playSmall, { color }]}>▶</ThemedText>
      )}
    </ProgressRing>
  );
}

const styles = StyleSheet.create({
  playLarge: { fontSize: 14, lineHeight: 18 },
  playSmall: { fontSize: 8, lineHeight: 10, marginLeft: 1 },
  check: { fontSize: 11, lineHeight: 14, fontWeight: '700' },
  stopIcon: {
    width: 8,
    height: 8,
    borderRadius: 1.5,
  },
});
