// Week view: seven day columns aligned to the user's chosen week-start day.
// Swipe horizontally to advance by 7 days. Columns are narrow so each row
// is rendered compactly (marker + emoji only).

import { useEffect, useMemo, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import PagerView from 'react-native-pager-view';

import { ThemedText } from '@/components/themed-text';
import { isoDate } from '@/lib/habits';
import {
  weekDatesFrom,
  type AgendaRow as AgendaRowT,
  type DayGroup,
} from '@/lib/history';

type Props = {
  anchorDate: Date;
  weekStart: number;
  dayGroups: DayGroup[];
  onAnchorChange: (date: Date) => void;
  onColumnPress: (iso: string) => void;
};

export function CalendarWeekView({
  anchorDate,
  weekStart,
  dayGroups,
  onAnchorChange,
  onColumnPress,
}: Props) {
  const pagerRef = useRef<PagerView>(null);

  // Three weeks: previous, current (containing anchor), next.
  const weekStarts = useMemo(() => {
    const out: Date[] = [];
    for (let weekOffset = -1; weekOffset <= 1; weekOffset++) {
      const d = new Date(anchorDate);
      d.setDate(anchorDate.getDate() + weekOffset * 7);
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
        onAnchorChange(weekStarts[idx]);
      }}>
      {weekStarts.map((anchorForPage, pageIdx) => (
        <View key={pageIdx} style={styles.page}>
          <WeekColumns
            weekDays={weekDatesFrom(anchorForPage, weekStart)}
            groupByIso={groupByIso}
            onColumnPress={onColumnPress}
          />
        </View>
      ))}
    </PagerView>
  );
}

function WeekColumns({
  weekDays,
  groupByIso,
  onColumnPress,
}: {
  weekDays: string[];
  groupByIso: Map<string, DayGroup>;
  onColumnPress: (iso: string) => void;
}) {
  const todayIso = isoDate(new Date());
  return (
    <View style={styles.columnsRow}>
      {weekDays.map((iso, i) => {
        const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
        const date = new Date(y, m - 1, d);
        const group = groupByIso.get(iso);
        const isToday = iso === todayIso;
        return (
          <Pressable
            key={iso}
            onPress={() => onColumnPress(iso)}
            style={({ pressed }) => [
              styles.column,
              i < 6 && styles.columnDivider,
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
            <ScrollView contentContainerStyle={styles.cellContent}>
              {(group?.rows ?? []).map((row, ri) => (
                <CompactRow key={ri} row={row} />
              ))}
            </ScrollView>
          </Pressable>
        );
      })}
    </View>
  );
}

function CompactRow({ row }: { row: AgendaRowT }) {
  const isSkip = row.kind === 'skip';
  const isScheduled = row.kind === 'scheduled';
  const marker = isSkip ? '—' : isScheduled ? '○' : '✓';
  return (
    <View
      style={[
        styles.compactRow,
        row.habit.color ? { borderLeftColor: row.habit.color } : null,
      ]}>
      <ThemedText style={[styles.marker, isSkip && styles.markerDim]}>
        {marker}
      </ThemedText>
      <ThemedText style={styles.emoji}>{row.habit.icon ?? '·'}</ThemedText>
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
  columnPressed: { backgroundColor: 'rgba(127,127,127,0.08)' },
  dayHeader: {
    paddingVertical: 8,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(127,127,127,0.2)',
  },
  weekday: { fontSize: 10, opacity: 0.55, textTransform: 'uppercase', letterSpacing: 0.5 },
  dateNum: { fontSize: 16, marginTop: 1 },
  todayText: { color: '#7c3aed', fontWeight: '600', opacity: 1 },
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
  marker: { fontSize: 11, opacity: 0.75 },
  markerDim: { opacity: 0.45 },
  emoji: { fontSize: 12 },
});
