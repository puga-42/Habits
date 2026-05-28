// Week view: seven day columns aligned to the user's chosen week-start day.
// Swipe horizontally to advance by 7 days. Columns are narrow so each row
// is rendered compactly (marker + emoji only).

import { useEffect, useMemo, useRef, useState } from 'react';
import { GestureResponderEvent, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import PagerView from 'react-native-pager-view';

import { ThemedText } from '@/components/themed-text';
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
  onAnchorChange: (date: Date) => void;
  onColumnPress: (iso: string) => void;
  onRowPress: (row: AgendaRowT, dateIso: string) => void;
};

export function CalendarWeekView({
  anchorDate,
  weekStart,
  habits,
  dayGroups,
  onAnchorChange,
  onColumnPress,
  onRowPress,
}: Props) {
  const pagerRef = useRef<PagerView>(null);
  const pendingIdx = useRef<number | null>(null);
  const scrollState = useRef('idle');

  const weekStarts = useMemo(() => {
    const out: Date[] = [];
    for (let weekOffset = -5; weekOffset <= 5; weekOffset++) {
      const d = new Date(anchorDate);
      d.setDate(anchorDate.getDate() + weekOffset * 7);
      d.setHours(0, 0, 0, 0);
      out.push(d);
    }
    return out;
  }, [anchorDate]);

  useEffect(() => {
    if (scrollState.current === 'idle') {
      pagerRef.current?.setPageWithoutAnimation(5);
    }
  }, [anchorDate]);

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
    <PagerView
      ref={pagerRef}
      initialPage={5}
      style={styles.pager}
      onPageSelected={(e) => {
        pendingIdx.current = e.nativeEvent.position;
      }}
      onPageScrollStateChanged={(e) => {
        scrollState.current = e.nativeEvent.pageScrollState;
        if (scrollState.current === 'idle' && pendingIdx.current !== null) {
          const idx = pendingIdx.current;
          pendingIdx.current = null;
          if (idx !== 5) onAnchorChange(weekStarts[idx]);
        }
      }}>
      {weekStarts.map((anchorForPage, pageIdx) => (
        <View key={pageIdx} style={styles.page}>
          <WeekColumns
            weekDays={weekDatesFrom(anchorForPage, weekStart)}
            groupByIso={groupByIso}
            habitMap={habitMap}
            onColumnPress={onColumnPress}
            onRowPress={onRowPress}
          />
        </View>
      ))}
    </PagerView>
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
  compactRowMuted: { opacity: 0.5 },
  icon: { fontSize: 14 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotFallback: { backgroundColor: 'rgba(127,127,127,0.5)' },
});
