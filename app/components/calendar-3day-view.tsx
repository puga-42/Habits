// 3-day view: three day columns side by side; swipe horizontally to advance
// by 3 days. Today is the leftmost column on first open.

import { useEffect, useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import PagerView from 'react-native-pager-view';

import { AgendaRow } from '@/components/agenda-row';
import { ThemedText } from '@/components/themed-text';
import { isoDate } from '@/lib/habits';
import type { AgendaRow as AgendaRowT, DayGroup } from '@/lib/history';

type Props = {
  anchorDate: Date;
  dayGroups: DayGroup[];
  onAnchorChange: (date: Date) => void;
  onRowPress: (row: AgendaRowT, dateIso: string) => void;
  onRowLongPress: (row: AgendaRowT, dateIso: string) => void;
};

export function Calendar3DayView({
  anchorDate,
  dayGroups,
  onAnchorChange,
  onRowPress,
  onRowLongPress,
}: Props) {
  const pagerRef = useRef<PagerView>(null);

  // Three 3-day windows: previous triple, current triple, next triple.
  const windowStarts = useMemo(() => {
    const out: Date[] = [];
    for (let pageOffset = -1; pageOffset <= 1; pageOffset++) {
      const d = new Date(anchorDate);
      d.setDate(anchorDate.getDate() + pageOffset * 3);
      d.setHours(0, 0, 0, 0);
      out.push(d);
    }
    return out;
  }, [anchorDate]);

  useEffect(() => {
    pagerRef.current?.setPageWithoutAnimation(1);
  }, [anchorDate]);

  const groupByIso = useMemo(() => {
    const m = new Map<string, DayGroup>();
    for (const g of dayGroups) m.set(g.date, g);
    return m;
  }, [dayGroups]);

  return (
    <PagerView
      ref={pagerRef}
      initialPage={1}
      style={styles.pager}
      onPageSelected={(e) => {
        const idx = e.nativeEvent.position;
        if (idx === 1) return;
        onAnchorChange(windowStarts[idx]);
      }}>
      {windowStarts.map((start, pageIdx) => (
        <View key={pageIdx} style={styles.page}>
          <ColumnsPage
            start={start}
            groupByIso={groupByIso}
            onRowPress={onRowPress}
            onRowLongPress={onRowLongPress}
          />
        </View>
      ))}
    </PagerView>
  );
}

function ColumnsPage({
  start,
  groupByIso,
  onRowPress,
  onRowLongPress,
}: {
  start: Date;
  groupByIso: Map<string, DayGroup>;
  onRowPress: (row: AgendaRowT, dateIso: string) => void;
  onRowLongPress: (row: AgendaRowT, dateIso: string) => void;
}) {
  const days = [0, 1, 2].map((off) => {
    const d = new Date(start);
    d.setDate(start.getDate() + off);
    return d;
  });

  return (
    <View style={styles.columnsRow}>
      {days.map((d, i) => (
        <View key={i} style={[styles.column, i < 2 && styles.columnDivider]}>
          <DayHeader date={d} />
          <ScrollView contentContainerStyle={styles.columnContent}>
            {(groupByIso.get(isoDate(d))?.rows ?? []).length === 0 ? (
              <ThemedText style={styles.emptyText}>—</ThemedText>
            ) : (
              groupByIso.get(isoDate(d))!.rows.map((row, ri) => (
                <AgendaRow
                  key={ri}
                  row={row}
                  onPress={() => onRowPress(row, isoDate(d))}
                  onLongPress={() => onRowLongPress(row, isoDate(d))}
                />
              ))
            )}
          </ScrollView>
        </View>
      ))}
    </View>
  );
}

function DayHeader({ date }: { date: Date }) {
  const isToday = isoDate(date) === isoDate(new Date());
  return (
    <View style={styles.dayHeader}>
      <ThemedText style={[styles.dayWeekday, isToday && styles.dayEmphasis]}>
        {date.toLocaleDateString('en-US', { weekday: 'short' })}
      </ThemedText>
      <ThemedText style={[styles.dayDate, isToday && styles.dayEmphasis]}>
        {date.getDate()}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  pager: { flex: 1 },
  page: { flex: 1 },
  columnsRow: { flex: 1, flexDirection: 'row' },
  column: { flex: 1 },
  columnDivider: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: 'rgba(127,127,127,0.2)',
  },
  dayHeader: {
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(127,127,127,0.2)',
  },
  dayWeekday: { fontSize: 11, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 0.5 },
  dayDate: { fontSize: 20, marginTop: 2 },
  dayEmphasis: { color: '#7c3aed', opacity: 1 },
  columnContent: { padding: 8, paddingBottom: 100 },
  emptyText: { fontSize: 12, opacity: 0.4, textAlign: 'center', paddingVertical: 20 },
});
