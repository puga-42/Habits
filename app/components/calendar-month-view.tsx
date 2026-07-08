// Month view: Google Calendar-style 6x7 grid with habit chips per cell.
// Tap a cell to switch to Day view anchored on that date.

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTokens } from '@/hooks/use-tokens';
import type { DayGroup, MonthCell } from '@/lib/history';

type CellHabit = {
  id: string;
  title: string;
  icon: string | null;
  color: string | null;
};

type Props = {
  cells: MonthCell[];
  groupByIso: Map<string, DayGroup>;
  selectedIso: string | null;
  onSelectDay: (iso: string) => void;
};

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const MAX_CHIPS = 3;

export function CalendarMonthView({
  cells,
  groupByIso,
  selectedIso,
  onSelectDay,
}: Props) {
  const weeks = useMemo(() => {
    const out: MonthCell[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      out.push(cells.slice(i, i + 7));
    }
    return out;
  }, [cells]);

  const [containerH, setContainerH] = useState(0);
  const [contentH, setContentH] = useState(0);
  const scrollEnabled = contentH > containerH;

  return (
    <ScrollView
      onLayout={(e) => setContainerH(e.nativeEvent.layout.height)}
      onContentSizeChange={(_w, h) => setContentH(h)}
      scrollEnabled={scrollEnabled}
      contentContainerStyle={styles.scrollContent}>
      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((d, i) => (
          <ThemedText key={i} style={styles.weekday}>
            {d}
          </ThemedText>
        ))}
      </View>
      <View style={styles.grid}>
        {weeks.map((week, wi) => (
          <View key={wi} style={styles.weekRow}>
            {week.map((cell) => (
              <MonthCellView
                key={cell.iso}
                cell={cell}
                group={groupByIso.get(cell.iso)}
                isSelected={selectedIso === cell.iso}
                onPress={() => onSelectDay(cell.iso)}
              />
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function MonthCellView({
  cell,
  group,
  isSelected,
  onPress,
}: {
  cell: MonthCell;
  group: DayGroup | undefined;
  isSelected: boolean;
  onPress: () => void;
}) {
  const t = useTokens();
  const habits = useMemo(() => uniqueHabits(group?.rows ?? []), [group]);
  const visible = habits.slice(0, MAX_CHIPS);
  const overflow = Math.max(0, habits.length - MAX_CHIPS);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.cell,
        cell.isToday && !isSelected && { borderColor: t.today },
        isSelected && { borderColor: t.accent, borderWidth: 2 },
        pressed && styles.cellPressed,
      ]}>
      <ThemedText
        style={[
          styles.dayNumber,
          !cell.inMonth && styles.dayNumberOutside,
          cell.isFuture && cell.inMonth && styles.dayNumberFuture,
          (cell.isToday || isSelected) && styles.dayNumberEmphasis,
        ]}>
        {cell.date.getDate()}
      </ThemedText>
      <View style={styles.chips}>
        {visible.map((h) =>
          h.icon ? (
            <ThemedText key={h.id} style={styles.chipIcon}>
              {h.icon}
            </ThemedText>
          ) : (
            <View
              key={h.id}
              style={[styles.dot, { backgroundColor: h.color ?? t.ink45 }]}
            />
          ),
        )}
        {overflow > 0 && (
          <ThemedText style={styles.overflow}>+{overflow}</ThemedText>
        )}
      </View>
    </Pressable>
  );
}

function uniqueHabits(rows: DayGroup['rows']): CellHabit[] {
  const seen = new Set<string>();
  const out: CellHabit[] = [];
  for (const row of rows) {
    const id =
      row.kind === 'completion' ? row.habit.id : row.habitId;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      title: row.habit.title,
      icon: row.habit.icon,
      color: row.habit.color,
    });
  }
  return out;
}

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 8, paddingBottom: 100 },
  weekdayRow: { flexDirection: 'row', paddingVertical: 6 },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    opacity: 0.5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  grid: {},
  weekRow: { flexDirection: 'row' },
  cell: {
    flex: 1,
    minHeight: 76,
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 2,
    borderWidth: 1.5,
    borderColor: 'transparent',
    borderRadius: 4,
    alignItems: 'stretch',
  },
  cellPressed: { opacity: 0.6 },
  dayNumber: { fontSize: 13, opacity: 0.85 },
  dayNumberOutside: { opacity: 0.25 },
  dayNumberFuture: { opacity: 0.6 },
  dayNumberEmphasis: { fontWeight: '600', opacity: 1 },
  chips: { marginTop: 4, gap: 2, flexDirection: 'row', flexWrap: 'wrap' },
  chipIcon: { fontSize: 12, lineHeight: 16 },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 4 },
  overflow: { fontSize: 10, opacity: 0.5, marginTop: 2 },
});
