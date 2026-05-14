// Shared row for any agenda-style view (day, 3-day, week, schedule).
// Renders the habit's swatch, marker, and title. Two gestures on the row:
//   - tap        → onPress (typically: mark complete / un-complete)
//   - long-press → onLongPress (typically: activate DraggableFlatList reorder)
//
// Views that don't support reorder simply omit onLongPress.

import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { AgendaRow as AgendaRowT } from '@/lib/history';

const LONG_PRESS_MS = 300;

type Props = {
  row: AgendaRowT;
  onPress?: () => void;
  onLongPress?: () => void;
  // Accepted for API compatibility with DraggableFlatList's RenderItemParams;
  // the row's appearance never changes — finger on the moving row is enough
  // visual feedback.
  isActive?: boolean;
};

export function AgendaRow({ row, onPress, onLongPress }: Props) {
  const isSkip = row.kind === 'skip';
  const isScheduled = row.kind === 'scheduled';
  const isCompletion = row.kind === 'completion';
  const marker = isSkip ? '—' : isScheduled ? '○' : '✓';

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={LONG_PRESS_MS}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <View
        style={[
          styles.swatch,
          row.habit.color ? { backgroundColor: row.habit.color } : styles.swatchFallback,
          (isSkip || isScheduled) && styles.swatchDim,
          isCompletion && styles.swatchCompletion,
        ]}
      />
      <ThemedText
        style={[
          styles.marker,
          isSkip && styles.markerMuted,
          (isScheduled || isCompletion) && styles.markerMuted,
        ]}>
        {marker}
      </ThemedText>
      <ThemedText
        style={[
          styles.title,
          isSkip && styles.skipText,
          isScheduled && styles.scheduledText,
          isCompletion && styles.completionText,
        ]}
        numberOfLines={1}>
        {row.habit.icon ? `${row.habit.icon}  ` : ''}
        {row.habit.title}
      </ThemedText>
      {isSkip ? <ThemedText style={styles.meta}>(skipped)</ThemedText> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(127,127,127,0.18)',
  },
  rowPressed: { opacity: 0.55 },
  swatch: { width: 8, height: 24, borderRadius: 2 },
  swatchFallback: { backgroundColor: 'rgba(127,127,127,0.4)' },
  swatchDim: { opacity: 0.4 },
  swatchCompletion: { opacity: 0.45 },
  marker: { fontSize: 16, width: 18, textAlign: 'center', opacity: 0.85 },
  markerMuted: { opacity: 0.5 },
  title: { flex: 1, fontSize: 16 },
  skipText: { opacity: 0.55, textDecorationLine: 'line-through' },
  scheduledText: { opacity: 0.78 },
  completionText: { opacity: 0.5 },
  meta: { fontSize: 13, opacity: 0.55 },
});
