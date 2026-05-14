// Schedule view: one continuous chronological list with sticky day headers
// AND section-local drag-to-reorder, built on a single DraggableFlatList.
//
// Data is a flat array of mixed items: day headers, optional Completed
// sub-headers, empty-day placeholders, and habit rows tagged with their day
// and section. `stickyHeaderIndices` (a FlatList prop that DraggableFlatList
// passes through) pins day headers as the user scrolls. `onDragEnd`
// validates that a moved row's new position is still in the same day and
// same section; invalid drops snap back via local state reset.
//
// "Load earlier" and "Load more" buttons live in
// `ListHeaderComponent` / `ListFooterComponent` so they don't disrupt the
// sticky-header indices.

import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import DraggableFlatList, {
  type RenderItemParams,
} from 'react-native-draggable-flatlist';

import { AgendaRow } from '@/components/agenda-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import type { Habit } from '@/lib/habits';
import {
  partitionRows,
  type AgendaRow as AgendaRowT,
  type DayGroup,
} from '@/lib/history';

type Section = 'notCompleted' | 'completed';

type ScheduleItem =
  | { kind: 'day-header'; iso: string; isToday: boolean }
  | { kind: 'completed-header'; iso: string }
  | { kind: 'empty-day'; iso: string }
  | { kind: 'row'; iso: string; section: Section; row: AgendaRowT };

const SNAPPY_DROP = { damping: 30, stiffness: 700, mass: 0.6 };

type Props = {
  dayGroups: DayGroup[];
  habits: Habit[];
  todayIso: string;
  onLoadEarlier: () => void;
  onLoadMore: () => void;
  onRowPress: (row: AgendaRowT, dateIso: string) => void;
  onReorderSection: (
    dateIso: string,
    section: Section,
    newRows: AgendaRowT[],
  ) => void;
};

export function CalendarScheduleView({
  dayGroups,
  habits,
  todayIso,
  onLoadEarlier,
  onLoadMore,
  onRowPress,
  onReorderSection,
}: Props) {
  const habitMap = useMemo(() => {
    const m = new Map<string, Habit>();
    for (const h of habits) m.set(h.id, h);
    return m;
  }, [habits]);

  // We render `data` directly from props on every render. The earlier
  // approach mirrored this into local state via useEffect, which created an
  // infinite re-render loop whenever `buildScheduleData` produced a new
  // reference (every render) and the effect re-triggered itself.
  const data = useMemo(
    () => buildScheduleData(dayGroups, habitMap, todayIso),
    [dayGroups, habitMap, todayIso],
  );

  // Bumped on invalid drops to force the DraggableFlatList to remount and
  // reset its internal post-drag state back to the source data.
  const [generation, setGeneration] = useState(0);

  const stickyHeaderIndices = useMemo(
    () =>
      data.flatMap((item, i) => (item.kind === 'day-header' ? [i] : [])),
    [data],
  );

  const keyExtractor = (item: ScheduleItem): string => {
    if (item.kind === 'day-header') return `dh-${item.iso}`;
    if (item.kind === 'completed-header') return `ch-${item.iso}`;
    if (item.kind === 'empty-day') return `e-${item.iso}`;
    if (item.row.kind === 'completion') return `c-${item.row.id}-${item.iso}`;
    return `${item.row.kind}-${item.row.habitId}-${item.iso}`;
  };

  const renderItem = ({
    item,
    drag,
    isActive,
  }: RenderItemParams<ScheduleItem>) => {
    if (item.kind === 'day-header') {
      return (
        <ThemedView
          style={[styles.dayHeader, item.isToday && styles.dayHeaderToday]}>
          <ThemedText
            style={[
              styles.dayHeaderText,
              item.isToday && styles.dayHeaderTextToday,
            ]}>
            {formatDay(item.iso)}
            {item.isToday ? '  ·  Today' : ''}
          </ThemedText>
        </ThemedView>
      );
    }
    if (item.kind === 'completed-header') {
      return (
        <View style={styles.completedSub}>
          <View style={styles.completedRule} />
          <ThemedText style={styles.completedLabel}>Completed</ThemedText>
          <View style={styles.completedRule} />
        </View>
      );
    }
    if (item.kind === 'empty-day') {
      return <ThemedText style={styles.empty}>No completions</ThemedText>;
    }
    return (
      <AgendaRow
        row={item.row}
        onPress={() => onRowPress(item.row, item.iso)}
        onLongPress={drag}
        isActive={isActive}
      />
    );
  };

  const onDragEnd = ({
    data: newData,
    from,
    to,
  }: {
    data: ScheduleItem[];
    from: number;
    to: number;
  }) => {
    // No movement (e.g. user tapped the handle and released without dragging).
    // Don't trigger an optimistic state update + network reorder for a no-op.
    if (from === to) return;
    const moved = newData[to];
    if (!moved || moved.kind !== 'row') {
      setGeneration((g) => g + 1);
      return;
    }
    const ctx = contextAt(newData, to);
    if (ctx.day !== moved.iso || ctx.section !== moved.section) {
      // Crossed a day or section boundary — force a remount so the lib
      // resets to the source order.
      setGeneration((g) => g + 1);
      return;
    }
    const sectionRows = rowsInSection(newData, moved.iso, moved.section);
    onReorderSection(moved.iso, moved.section, sectionRows);
  };

  return (
    <DraggableFlatList
      key={generation}
      data={data}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      onDragEnd={onDragEnd}
      stickyHeaderIndices={stickyHeaderIndices}
      animationConfig={SNAPPY_DROP}
      autoscrollSpeed={0}
      autoscrollThreshold={0}
      containerStyle={styles.containerFlex}
      contentContainerStyle={styles.content}
      ListHeaderComponent={
        <Pressable
          onPress={onLoadEarlier}
          style={({ pressed }) => [styles.loadAction, pressed && styles.pressed]}>
          <ThemedText style={styles.loadActionText}>‹ Load earlier</ThemedText>
        </Pressable>
      }
      ListFooterComponent={
        <Pressable
          onPress={onLoadMore}
          style={({ pressed }) => [styles.loadAction, pressed && styles.pressed]}>
          <ThemedText style={styles.loadActionText}>Load more ›</ThemedText>
        </Pressable>
      }
    />
  );
}

// ─── Data + validation ─────────────────────────────────────────────────────

function buildScheduleData(
  dayGroups: DayGroup[],
  habitMap: Map<string, Habit>,
  todayIso: string,
): ScheduleItem[] {
  const out: ScheduleItem[] = [];
  for (const g of dayGroups) {
    out.push({ kind: 'day-header', iso: g.date, isToday: g.date === todayIso });
    if (g.rows.length === 0) {
      out.push({ kind: 'empty-day', iso: g.date });
      continue;
    }
    const { notCompleted, completed } = partitionRows(g.rows, habitMap);
    for (const row of notCompleted) {
      out.push({ kind: 'row', iso: g.date, section: 'notCompleted', row });
    }
    if (notCompleted.length > 0 && completed.length > 0) {
      out.push({ kind: 'completed-header', iso: g.date });
    }
    for (const row of completed) {
      out.push({ kind: 'row', iso: g.date, section: 'completed', row });
    }
  }
  return out;
}

// Walks from the start of the array to `index` to figure out which day and
// section the item at `index` is currently sitting in.
function contextAt(
  data: ScheduleItem[],
  index: number,
): { day: string | null; section: Section } {
  let day: string | null = null;
  let section: Section = 'notCompleted';
  for (let i = 0; i <= index; i++) {
    const item = data[i];
    if (item.kind === 'day-header') {
      day = item.iso;
      section = 'notCompleted';
    } else if (item.kind === 'completed-header') {
      section = 'completed';
    }
  }
  return { day, section };
}

function rowsInSection(
  data: ScheduleItem[],
  iso: string,
  section: Section,
): AgendaRowT[] {
  const rows: AgendaRowT[] = [];
  let currentDay: string | null = null;
  let currentSection: Section = 'notCompleted';
  for (const item of data) {
    if (item.kind === 'day-header') {
      currentDay = item.iso;
      currentSection = 'notCompleted';
    } else if (item.kind === 'completed-header') {
      currentSection = 'completed';
    } else if (item.kind === 'row') {
      if (currentDay === iso && currentSection === section) {
        rows.push(item.row);
      }
    }
  }
  return rows;
}

function formatDay(iso: string): string {
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

// ─── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  containerFlex: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 100 },
  loadAction: {
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(127,127,127,0.2)',
    marginBottom: 4,
  },
  pressed: { opacity: 0.5 },
  loadActionText: { fontSize: 14, opacity: 0.6 },
  dayHeader: {
    paddingTop: 14,
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(127,127,127,0.18)',
  },
  dayHeaderToday: { borderBottomColor: 'rgba(124,58,237,0.6)' },
  dayHeaderText: { fontSize: 14, opacity: 0.7, fontWeight: '600' },
  dayHeaderTextToday: { color: '#7c3aed', opacity: 1 },
  empty: { fontSize: 13, opacity: 0.4, paddingVertical: 8, fontStyle: 'italic' },
  completedSub: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 2,
  },
  completedRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(127,127,127,0.25)',
  },
  completedLabel: {
    fontSize: 11,
    opacity: 0.55,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});
