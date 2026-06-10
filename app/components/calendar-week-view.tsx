import { useMemo, useState } from 'react';
import { GestureResponderEvent, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Palette } from '@/constants/colors';
import { isoDate, type Habit } from '@/lib/habits';
import {
  partitionRows,
  weekDatesFrom,
  type AgendaRow as AgendaRowT,
  type DayGroup,
} from '@/lib/history';

type Props = {
  anchorDate: Date;
  weekStart: number;
  habits: Habit[];
  dayGroups: DayGroup[];
  onColumnPress: (iso: string) => void;
  onRowPress: (row: AgendaRowT, dateIso: string) => void;
};

export function CalendarWeekView({
  anchorDate,
  weekStart,
  habits,
  dayGroups,
  onColumnPress,
  onRowPress,
}: Props) {
  const groupByIso = useMemo(() => {
    const m = new Map<string, DayGroup>();
    for (const g of dayGroups) m.set(g.date, g);
    return m;
  }, [dayGroups]);

  const habitMap = useMemo(() => {
    const m = new Map<string, Habit>();
    for (const h of habits) m.set(h.id, h);
    return m;
  }, [habits]);

  return (
    <View style={styles.root}>
      <WeekColumns
        weekDays={weekDatesFrom(anchorDate, weekStart)}
        groupByIso={groupByIso}
        habitMap={habitMap}
        onColumnPress={onColumnPress}
        onRowPress={onRowPress}
      />
    </View>
  );
}

function WeekColumns({
  weekDays,
  groupByIso,
  habitMap,
  onColumnPress,
  onRowPress,
}: {
  weekDays: string[];
  groupByIso: Map<string, DayGroup>;
  habitMap: Map<string, Habit>;
  onColumnPress: (iso: string) => void;
  onRowPress: (row: AgendaRowT, dateIso: string) => void;
}) {
  const todayIso = isoDate(new Date());
  return (
    <View style={styles.columnsRow}>
      {weekDays.map((iso, i) => (
        <WeekColumn
          key={iso}
          iso={iso}
          isFirst={i === 0}
          isLast={i === 6}
          todayIso={todayIso}
          group={groupByIso.get(iso)}
          habitMap={habitMap}
          onColumnPress={onColumnPress}
          onRowPress={onRowPress}
        />
      ))}
    </View>
  );
}

function WeekColumn({
  iso,
  isLast,
  todayIso,
  group,
  habitMap,
  onColumnPress,
  onRowPress,
}: {
  iso: string;
  isFirst: boolean;
  isLast: boolean;
  todayIso: string;
  group: DayGroup | undefined;
  habitMap: Map<string, Habit>;
  onColumnPress: (iso: string) => void;
  onRowPress: (row: AgendaRowT, dateIso: string) => void;
}) {
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  const date = new Date(y, m - 1, d);
  const isToday = iso === todayIso;
  const { notCompleted, completed } = partitionRows(group?.rows ?? [], habitMap);
  const sortedRows = [...notCompleted, ...completed];

  const [containerH, setContainerH] = useState(0);
  const [contentH, setContentH] = useState(0);
  const scrollEnabled = contentH > containerH;

  return (
    <Pressable
      onPress={() => onColumnPress(iso)}
      style={({ pressed }) => [
        styles.column,
        !isLast && styles.columnDivider,
        pressed && styles.columnPressed,
      ]}>
      <View style={styles.dayHeader}>
        <ThemedText style={[styles.weekday, isToday && styles.todayText]}>
          {date.toLocaleDateString('en-US', { weekday: 'narrow' })}
        </ThemedText>
        <ThemedText style={[styles.dateNum, isToday && styles.todayText]}>
          {date.getDate()}
        </ThemedText>
      </View>
      <ScrollView
        onLayout={(e) => setContainerH(e.nativeEvent.layout.height)}
        onContentSizeChange={(_w, h) => setContentH(h)}
        scrollEnabled={scrollEnabled}
        contentContainerStyle={styles.cellContent}>
        {sortedRows.map((row, ri) => (
          <CompactRow key={ri} row={row} onPress={onRowPress} dateIso={iso} />
        ))}
      </ScrollView>
    </Pressable>
  );
}

function CompactRow({
  row,
  dateIso,
  onPress,
}: {
  row: AgendaRowT;
  dateIso: string;
  onPress: (row: AgendaRowT, dateIso: string) => void;
}) {
  const isSkip = row.kind === 'skip';
  const isCompletion = row.kind === 'completion';
  return (
    <Pressable
      onPress={(e: GestureResponderEvent) => {
        e.stopPropagation();
        onPress(row, dateIso);
      }}
      style={[
        styles.compactRow,
        row.habit.color ? { borderLeftColor: row.habit.color } : null,
        (isCompletion || isSkip) && styles.compactRowMuted,
      ]}>
      {row.habit.icon ? (
        <ThemedText style={styles.icon}>{row.habit.icon}</ThemedText>
      ) : (
        <View
          style={[
            styles.dot,
            row.habit.color
              ? { backgroundColor: row.habit.color }
              : styles.dotFallback,
          ]}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  columnsRow: { flex: 1, flexDirection: 'row' },
  column: { flex: 1 },
  columnDivider: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: 'rgba(127,127,127,0.2)',
  },
  columnPressed: { backgroundColor: 'rgba(127,127,127,0.08)' },
  dayHeader: {
    paddingVertical: 8,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(127,127,127,0.2)',
  },
  weekday: { fontSize: 10, opacity: 0.55, textTransform: 'uppercase', letterSpacing: 0.5 },
  dateNum: { fontSize: 16, marginTop: 1 },
  todayText: { color: Palette.lavender, fontWeight: '600', opacity: 1 },
  cellContent: { padding: 2, paddingBottom: 80, gap: 2 },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderLeftWidth: 3,
    borderLeftColor: 'rgba(127,127,127,0.4)',
    backgroundColor: 'rgba(127,127,127,0.06)',
    borderRadius: 4,
    gap: 2,
  },
  compactRowMuted: { opacity: 0.5 },
  icon: { fontSize: 14 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotFallback: { backgroundColor: 'rgba(127,127,127,0.5)' },
});
