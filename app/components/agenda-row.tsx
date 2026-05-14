// Shared row for any agenda-style view (day, 3-day, week, schedule).

import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { AgendaRow as AgendaRowT } from '@/lib/history';

type Props = {
  row: AgendaRowT;
  onPress?: () => void;
  onLongPress?: () => void;
};

export function AgendaRow({ row, onPress, onLongPress }: Props) {
  const isSkip = row.kind === 'skip';
  const isScheduled = row.kind === 'scheduled';
  const marker = isSkip ? '—' : isScheduled ? '○' : '✓';

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <View
        style={[
          styles.swatch,
          row.habit.color ? { backgroundColor: row.habit.color } : styles.swatchFallback,
          (isSkip || isScheduled) && styles.swatchDim,
        ]}
      />
      <ThemedText
        style={[
          styles.marker,
          isSkip && styles.markerSkip,
          isScheduled && styles.markerScheduled,
        ]}>
        {marker}
      </ThemedText>
      <ThemedText
        style={[styles.title, isSkip && styles.skipText, isScheduled && styles.scheduledText]}
        numberOfLines={1}>
        {row.habit.icon ? `${row.habit.icon}  ` : ''}
        {row.habit.title}
      </ThemedText>
      {isSkip ? (
        <ThemedText style={styles.meta}>(skipped)</ThemedText>
      ) : row.time ? (
        <ThemedText style={[styles.meta, isScheduled && styles.metaScheduled]}>
          {row.time.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(127,127,127,0.18)',
  },
  rowPressed: { opacity: 0.5 },
  swatch: { width: 8, height: 24, borderRadius: 2 },
  swatchFallback: { backgroundColor: 'rgba(127,127,127,0.4)' },
  swatchDim: { opacity: 0.4 },
  marker: { fontSize: 16, width: 18, textAlign: 'center', opacity: 0.85 },
  markerSkip: { opacity: 0.5 },
  markerScheduled: { opacity: 0.55 },
  title: { flex: 1, fontSize: 16 },
  skipText: { opacity: 0.55, textDecorationLine: 'line-through' },
  scheduledText: { opacity: 0.75 },
  meta: { fontSize: 13, opacity: 0.55 },
  metaScheduled: { opacity: 0.45 },
});
