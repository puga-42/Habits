import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { MonthCell } from '@/lib/history';

type Props = {
  cells: MonthCell[];
  activityDates: Set<string>;
  selectedIso: string | null;
  onSelectDay: (iso: string) => void;
};

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function HistoryCalendar({ cells, activityDates, selectedIso, onSelectDay }: Props) {
  // Chunk cells into rows of 7. Doing this explicitly (instead of letting
  // flexWrap handle a flat row) avoids a sub-pixel overflow bug where
  // `width: 100/7%` rounds slightly above 1/7 and the 7th cell wraps to a
  // new row — visually shifting every date one column to the right.
  const weeks = useMemo(() => {
    const out: MonthCell[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      out.push(cells.slice(i, i + 7));
    }
    return out;
  }, [cells]);

  return (
    <View style={styles.root}>
      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((d, i) => (
          <ThemedText key={i} style={styles.weekday}>
            {d}
          </ThemedText>
        ))}
      </View>
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.weekRow}>
          {week.map((cell) => {
            const showDot = cell.inMonth && activityDates.has(cell.iso);
            const isSelected = selectedIso === cell.iso;
            return (
              <Pressable
                key={cell.iso}
                onPress={() => onSelectDay(cell.iso)}
                style={({ pressed }) => [
                  styles.cell,
                  isSelected && styles.cellSelected,
                  cell.isToday && !isSelected && styles.cellToday,
                  pressed && styles.cellPressed,
                ]}>
                <ThemedText
                  style={[
                    styles.cellDay,
                    !cell.inMonth && styles.cellDayOutside,
                    cell.isFuture && cell.inMonth && styles.cellDayFuture,
                    (isSelected || cell.isToday) && styles.cellDayEmphasis,
                  ]}>
                  {cell.date.getDate()}
                </ThemedText>
                <View style={[styles.dot, !showDot && styles.dotHidden]} />
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 4 },
  weekdayRow: { flexDirection: 'row' },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    opacity: 0.5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  weekRow: { flexDirection: 'row' },
  cell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: 999,
  },
  cellPressed: { opacity: 0.5 },
  cellToday: { backgroundColor: 'rgba(127,127,127,0.12)' },
  cellSelected: { backgroundColor: 'rgba(127,127,127,0.28)' },
  cellDay: { fontSize: 15, opacity: 0.85 },
  cellDayOutside: { opacity: 0.25 },
  cellDayFuture: { opacity: 0.35 },
  cellDayEmphasis: { fontWeight: '600', opacity: 1 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(127,127,127,0.9)' },
  dotHidden: { opacity: 0 },
});
