// 3-day view: three day columns side by side; swipe horizontally to advance
// by 3 days. Today is the leftmost column on first open. Each column shows
// open habits on top and completed/skipped below (muted). No drag-reorder
// in this view — the columns are too tight for the handle.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import PagerView from 'react-native-pager-view';

import { HabitRowSwipeable } from '@/components/habit-row-swipeable';
import { ThemedText } from '@/components/themed-text';
import { isoDate, type Habit } from '@/lib/habits';
import {
  partitionRows,
  type AgendaRow as AgendaRowT,
  type DayGroup,
  type SwipeAction,
} from '@/lib/history';

type Props = {
  anchorDate: Date;
  habits: Habit[];
  dayGroups: DayGroup[];
  onAnchorChange: (date: Date) => void;
  onRowPress: (row: AgendaRowT, dateIso: string) => void;
  onSwipeAction: (row: AgendaRowT, dateIso: string, action: SwipeAction) => void;
  flexProgressByHabitId: Map<string, { count: number; target: number }>;
};

export function Calendar3DayView({
  anchorDate,
  habits,
  dayGroups,
  onAnchorChange,
  onRowPress,
  onSwipeAction,
  flexProgressByHabitId,
}: Props) {
  const pagerRef = useRef<PagerView>(null);

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

  const habitMap = useMemo(() => {
    const m = new Map<string, Habit>();
    for (const h of habits) m.set(h.id, h);
    return m;
  }, [habits]);

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
            habitMap={habitMap}
            onRowPress={onRowPress}
            onSwipeAction={onSwipeAction}
            flexProgressByHabitId={flexProgressByHabitId}
          />
        </View>
      ))}
    </PagerView>
  );
}

function ColumnsPage({
  start,
  groupByIso,
  habitMap,
  onRowPress,
  onSwipeAction,
  flexProgressByHabitId,
}: {
  start: Date;
  groupByIso: Map<string, DayGroup>;
  habitMap: Map<string, Habit>;
  onRowPress: (row: AgendaRowT, dateIso: string) => void;
  onSwipeAction: (row: AgendaRowT, dateIso: string, action: SwipeAction) => void;
  flexProgressByHabitId: Map<string, { count: number; target: number }>;
}) {
  const days = [0, 1, 2].map((off) => {
    const d = new Date(start);
    d.setDate(start.getDate() + off);
    return d;
  });

  // Shared drawer coordination across the three columns.
  const closeCurrentDrawer = useRef<(() => void) | null>(null);
  const handleDrawerOpen = useCallback((closeFn: () => void) => {
    closeCurrentDrawer.current?.();
    closeCurrentDrawer.current = closeFn;
  }, []);
  const handleDrawerClose = useCallback(() => {
    closeCurrentDrawer.current = null;
  }, []);

  return (
    <View style={styles.columnsRow}>
      {days.map((d, i) => (
        <View key={i} style={[styles.column, i < 2 && styles.columnDivider]}>
          <DayHeader date={d} />
          <DayColumn
            date={d}
            group={groupByIso.get(isoDate(d))}
            habitMap={habitMap}
            onRowPress={onRowPress}
            onSwipeAction={onSwipeAction}
            onDrawerOpen={handleDrawerOpen}
            onDrawerClose={handleDrawerClose}
            flexProgressByHabitId={flexProgressByHabitId}
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
  onSwipeAction,
  onDrawerOpen,
  onDrawerClose,
  flexProgressByHabitId,
}: {
  date: Date;
  group: DayGroup | undefined;
  habitMap: Map<string, Habit>;
  onRowPress: (row: AgendaRowT, dateIso: string) => void;
  onSwipeAction: (row: AgendaRowT, dateIso: string, action: SwipeAction) => void;
  onDrawerOpen: (closeFn: () => void) => void;
  onDrawerClose: () => void;
  flexProgressByHabitId: Map<string, { count: number; target: number }>;
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

  const renderRow = (row: AgendaRowT, idx: number) => {
    const habitId = row.kind === 'completion' ? row.habit.id : row.habitId;
    return (
      <View key={`${row.kind}-${idx}`} style={styles.rowWrap}>
        <HabitRowSwipeable
          row={row}
          dateIso={iso}
          onTrailingPress={() => onRowPress(row, iso)}
          onSwipeAction={(action) => onSwipeAction(row, iso, action)}
          onDrawerOpen={onDrawerOpen}
          onDrawerClose={onDrawerClose}
          compact
          flexProgress={flexProgressByHabitId.get(habitId)}
        />
      </View>
    );
  };

  return (
    <ScrollView
      onLayout={(e) => setContainerH(e.nativeEvent.layout.height)}
      onContentSizeChange={(_w, h) => setContentH(h)}
      scrollEnabled={scrollEnabled}
      onScrollBeginDrag={() => onDrawerOpen(() => {})}
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
  dayWeekday: {
    fontSize: 11,
    opacity: 0.6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dayDate: { fontSize: 20, marginTop: 2 },
  dayEmphasis: { color: '#7c3aed', opacity: 1 },
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
