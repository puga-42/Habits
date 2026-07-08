import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AgendaRow } from '@/components/agenda-row';
import { ThemedText } from '@/components/themed-text';
import { useTokens } from '@/hooks/use-tokens';
import { isoDate, type Habit } from '@/lib/habits';
import {
  partitionRows,
  type AgendaRow as AgendaRowT,
  type DayGroup,
} from '@/lib/history';

type Props = {
  anchorDate: Date;
  habits: Habit[];
  dayGroups: DayGroup[];
  onRowPress: (row: AgendaRowT, dateIso: string) => void;
};

export function Calendar3DayView({
  anchorDate,
  habits,
  dayGroups,
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
      <ColumnsPage
        start={anchorDate}
        groupByIso={groupByIso}
        habitMap={habitMap}
        onRowPress={onRowPress}
      />
    </View>
  );
}

function ColumnsPage({
  start,
  groupByIso,
  habitMap,
  onRowPress,
}: {
  start: Date;
  groupByIso: Map<string, DayGroup>;
  habitMap: Map<string, Habit>;
  onRowPress: (row: AgendaRowT, dateIso: string) => void;
}) {
  const t = useTokens();
  const days = [0, 1, 2].map((off) => {
    const d = new Date(start);
    d.setDate(start.getDate() + off);
    return d;
  });

  return (
    <View style={styles.columnsRow}>
      {days.map((d, i) => (
        <View
          key={i}
          style={[
            styles.column,
            i < 2 && [styles.columnDivider, { borderRightColor: t.hairlineStrong }],
          ]}>
          <DayHeader date={d} />
          <DayColumn
            date={d}
            group={groupByIso.get(isoDate(d))}
            habitMap={habitMap}
            onRowPress={onRowPress}
          />
        </View>
      ))}
    </View>
  );
}

function DayColumn({
  date,
  group,
  habitMap,
  onRowPress,
}: {
  date: Date;
  group: DayGroup | undefined;
  habitMap: Map<string, Habit>;
  onRowPress: (row: AgendaRowT, dateIso: string) => void;
}) {
  const iso = isoDate(date);
  const rows = group?.rows ?? [];
  const { notCompleted, completed } = useMemo(
    () => partitionRows(rows, habitMap),
    [rows, habitMap],
  );

  const [containerH, setContainerH] = useState(0);
  const [contentH, setContentH] = useState(0);
  const scrollEnabled = contentH > containerH;

  if (rows.length === 0) {
    return <ThemedText style={styles.emptyText}>—</ThemedText>;
  }

  const renderRow = (row: AgendaRowT, idx: number) => (
    <View key={`${row.kind}-${idx}`} style={styles.rowWrap}>
      <AgendaRow
        row={row}
        onPress={() => onRowPress(row, iso)}
        compact="tight"
      />
    </View>
  );

  return (
    <ScrollView
      onLayout={(e) => setContainerH(e.nativeEvent.layout.height)}
      onContentSizeChange={(_w, h) => setContentH(h)}
      scrollEnabled={scrollEnabled}
      contentContainerStyle={styles.columnContent}>
      {notCompleted.map(renderRow)}
      {completed.length > 0 && notCompleted.length > 0 && (
        <View style={styles.completedHeader}>
          <ThemedText style={styles.completedLabel}>Completed</ThemedText>
        </View>
      )}
      {completed.map((row, i) => renderRow(row, i + notCompleted.length))}
    </ScrollView>
  );
}

function DayHeader({ date }: { date: Date }) {
  const t = useTokens();
  const isToday = isoDate(date) === isoDate(new Date());
  return (
    <View style={[styles.dayHeader, { borderBottomColor: t.hairlineStrong }]}>
      <ThemedText style={[styles.dayWeekday, isToday && [styles.dayEmphasis, { color: t.today }]]}>
        {date.toLocaleDateString('en-US', { weekday: 'short' })}
      </ThemedText>
      <ThemedText style={[styles.dayDate, isToday && [styles.dayEmphasis, { color: t.today }]]}>
        {date.getDate()}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  columnsRow: { flex: 1, flexDirection: 'row' },
  column: { flex: 1 },
  columnDivider: {
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  dayHeader: {
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dayWeekday: {
    fontSize: 11,
    opacity: 0.6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dayDate: { fontSize: 20, marginTop: 2 },
  dayEmphasis: { opacity: 1 },
  columnContent: { padding: 6, paddingBottom: 100 },
  rowWrap: { marginBottom: 6 },
  emptyText: { fontSize: 12, opacity: 0.4, textAlign: 'center', paddingVertical: 20 },
  completedHeader: { paddingTop: 12, paddingBottom: 4, paddingHorizontal: 4 },
  completedLabel: {
    fontSize: 10,
    opacity: 0.55,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
