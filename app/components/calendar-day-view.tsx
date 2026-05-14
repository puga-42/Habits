// Day view: shows one day at a time, with horizontal swipe (via PagerView)
// to move +/-1 day. Each page hosts a single DraggableFlatList whose data
// is the day's rows interleaved with a non-draggable "Completed" header
// item. Drag-to-reorder works inside either section; cross-section drops
// are reverted via onDragEnd validation.
//
// This replaces the previous Nestable* structure. Combining
// NestableScrollContainer + multiple NestableDraggableFlatLists inside
// PagerView produced "ref.measureLayout must be called with a ref to a
// native component" warnings and various touch/scroll bugs. The single
// DraggableFlatList per page sits in a configuration the library is
// designed for.

import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import DraggableFlatList, {
  type RenderItemParams,
} from 'react-native-draggable-flatlist';
import PagerView from 'react-native-pager-view';

import { AgendaRow } from '@/components/agenda-row';
import { ThemedText } from '@/components/themed-text';
import { isoDate, type Habit } from '@/lib/habits';
import {
  partitionRows,
  type AgendaRow as AgendaRowT,
  type DayGroup,
} from '@/lib/history';

type Section = 'notCompleted' | 'completed';

type DayItem =
  | { kind: 'completed-header' }
  | { kind: 'all-done' }
  | { kind: 'row'; row: AgendaRowT; section: Section };

const SNAPPY_DROP = { damping: 30, stiffness: 700, mass: 0.6 };

type Props = {
  anchorDate: Date;
  habits: Habit[];
  dayGroups: DayGroup[];
  flexProgressByHabitId: Map<string, { count: number; target: number }>;
  onAnchorChange: (date: Date) => void;
  onRowPress: (row: AgendaRowT, dateIso: string) => void;
  onReorderSection: (
    dateIso: string,
    section: Section,
    newRows: AgendaRowT[],
  ) => void;
};

export function CalendarDayView({
  anchorDate,
  habits,
  dayGroups,
  flexProgressByHabitId,
  onAnchorChange,
  onRowPress,
  onReorderSection,
}: Props) {
  const pagerRef = useRef<PagerView>(null);

  const pageDates = useMemo(() => {
    const out: Date[] = [];
    for (let offset = -1; offset <= 1; offset++) {
      const d = new Date(anchorDate);
      d.setDate(anchorDate.getDate() + offset);
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
        onAnchorChange(pageDates[idx]);
      }}>
      {pageDates.map((d, idx) => (
        <View key={idx} style={styles.page} collapsable={false}>
          <DayContent
            date={d}
            group={groupByIso.get(isoDate(d))}
            habitMap={habitMap}
            flexProgressByHabitId={flexProgressByHabitId}
            onRowPress={onRowPress}
            onReorderSection={onReorderSection}
          />
        </View>
      ))}
    </PagerView>
  );
}

function DayContent({
  date,
  group,
  habitMap,
  flexProgressByHabitId,
  onRowPress,
  onReorderSection,
}: {
  date: Date;
  group: DayGroup | undefined;
  habitMap: Map<string, Habit>;
  flexProgressByHabitId: Map<string, { count: number; target: number }>;
  onRowPress: (row: AgendaRowT, dateIso: string) => void;
  onReorderSection: (
    dateIso: string,
    section: Section,
    newRows: AgendaRowT[],
  ) => void;
}) {
  const iso = isoDate(date);
  const rows = group?.rows ?? [];
  const { notCompleted, completed } = useMemo(
    () => partitionRows(rows, habitMap),
    [rows, habitMap],
  );

  // Flat data array: [...notCompletedRows, all-done?, completed-header?, ...completedRows].
  // We intentionally do NOT mirror this into local state — doing so with
  // useEffect caused an infinite re-render loop on days where `rows` is `[]`
  // (the empty-array literal creates a new reference every render, which
  // propagated through useMemo and re-triggered the effect).
  const data = useMemo<DayItem[]>(() => {
    const out: DayItem[] = [];
    if (notCompleted.length > 0) {
      for (const row of notCompleted) {
        out.push({ kind: 'row', row, section: 'notCompleted' });
      }
    } else if (completed.length > 0) {
      out.push({ kind: 'all-done' });
    }
    if (completed.length > 0) {
      out.push({ kind: 'completed-header' });
      for (const row of completed) {
        out.push({ kind: 'row', row, section: 'completed' });
      }
    }
    return out;
  }, [notCompleted, completed]);

  // A counter bumped on invalid drops; used as the DraggableFlatList's key so
  // the library remounts and resets its internal post-drag state back to
  // `data` (the source order).
  const [generation, setGeneration] = useState(0);

  if (rows.length === 0) {
    return (
      <View style={styles.emptyState}>
        <ThemedText style={styles.emptyText}>
          Nothing scheduled for this day.
        </ThemedText>
      </View>
    );
  }

  const keyExtractor = (item: DayItem): string => {
    if (item.kind === 'completed-header') return '__ch';
    if (item.kind === 'all-done') return '__ad';
    if (item.row.kind === 'completion') return `c-${item.row.id}`;
    return `${item.row.kind}-${item.row.habitId}`;
  };

  const renderItem = ({ item, drag, isActive }: RenderItemParams<DayItem>) => {
    if (item.kind === 'all-done') {
      return (
        <ThemedText style={styles.allDone}>Everything done for today.</ThemedText>
      );
    }
    if (item.kind === 'completed-header') {
      return (
        <View style={styles.completedHeader}>
          <View style={styles.completedRule} />
          <ThemedText style={styles.completedLabel}>Completed</ThemedText>
          <View style={styles.completedRule} />
        </View>
      );
    }
    const habitId =
      item.row.kind === 'completion' ? item.row.habit.id : item.row.habitId;
    return (
      <AgendaRow
        row={item.row}
        onPress={() => onRowPress(item.row, iso)}
        onLongPress={drag}
        flexProgress={flexProgressByHabitId.get(habitId)}
        isActive={isActive}
      />
    );
  };

  const ItemSeparator = () => <View style={styles.itemSeparator} />;

  const onDragEnd = ({
    data: newData,
    from,
    to,
  }: {
    data: DayItem[];
    from: number;
    to: number;
  }) => {
    // No movement (tap-only on the handle). Don't trigger an optimistic
    // state update + network reorder for a no-op.
    if (from === to) return;
    const moved = newData[to];
    if (!moved || moved.kind !== 'row') {
      setGeneration((g) => g + 1);
      return;
    }
    // Determine which section the row landed in by scanning for a
    // completed-header before the new position.
    let landedSection: Section = 'notCompleted';
    for (let i = 0; i < to; i++) {
      if (newData[i].kind === 'completed-header') {
        landedSection = 'completed';
        break;
      }
    }
    if (landedSection !== moved.section) {
      // Crossed the boundary; force a remount to snap back to source order.
      setGeneration((g) => g + 1);
      return;
    }
    // Valid: extract this section's rows in new order and propagate.
    // Screen will optimistically update sort_indexes, which will recompute
    // `data` to match the drop — no remount needed.
    const sectionRows: AgendaRowT[] = [];
    let currentSection: Section = 'notCompleted';
    for (const item of newData) {
      if (item.kind === 'completed-header') {
        currentSection = 'completed';
        continue;
      }
      if (item.kind === 'row' && currentSection === moved.section) {
        sectionRows.push(item.row);
      }
    }
    onReorderSection(iso, moved.section, sectionRows);
  };

  return (
    <DraggableFlatList
      key={generation}
      data={data}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      onDragEnd={onDragEnd}
      animationConfig={SNAPPY_DROP}
      autoscrollSpeed={0}
      autoscrollThreshold={0}
      // containerStyle sizes the outer wrapper that hosts the FlatList — the
      // PagerView page only fills if this is set; the inner FlatList's `style`
      // alone isn't enough.
      containerStyle={styles.scrollRoot}
      contentContainerStyle={styles.scrollContent}
      ItemSeparatorComponent={ItemSeparator}
      keyboardShouldPersistTaps="handled"
    />
  );
}

const styles = StyleSheet.create({
  pager: { flex: 1 },
  page: { flex: 1 },
  scrollRoot: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 120 },
  itemSeparator: { height: 10 },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: { opacity: 0.55, fontSize: 15 },
  allDone: { paddingVertical: 16, opacity: 0.55, fontSize: 14 },
  completedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  completedRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(127,127,127,0.3)',
  },
  completedLabel: {
    fontSize: 12,
    opacity: 0.55,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});
