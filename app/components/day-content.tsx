import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import DraggableFlatList, {
  type RenderItemParams,
} from 'react-native-draggable-flatlist';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';

import { AnimatedHabitRow } from '@/components/animated-habit-row';
import { HabitRowSwipeable } from '@/components/habit-row-swipeable';
import type { TimerStatus } from '@/components/time-trailing-icon';
import { ThemedText } from '@/components/themed-text';
import { diffDayHabits } from '@/lib/day-diff';
import { dayItemKey, type DayItem, type Section } from '@/lib/day-item-key';
import { isoDate, type Habit } from '@/lib/habits';
import {
  partitionRows,
  type AgendaRow as AgendaRowT,
  type DayGroup,
  type SwipeAction,
} from '@/lib/history';

const SNAPPY_DROP = { damping: 30, stiffness: 700, mass: 0.6 };

type Props = {
  date: Date;
  group: DayGroup | undefined;
  habitMap: Map<string, Habit>;
  flexProgressByHabitId: Map<string, { count: number; target: number }>;
  timeProgressByHabitId: Map<string, number>;
  streakByHabitId: Map<string, number>;
  activeTimerHabitId?: string | null;
  isFuture: boolean;
  onRowPress: (row: AgendaRowT, dateIso: string) => void;
  onPillPress?: (row: AgendaRowT, dateIso: string) => void;
  onSwipeAction: (row: AgendaRowT, dateIso: string, action: SwipeAction) => void;
  onReorderSection: (
    dateIso: string,
    section: Section,
    newRows: AgendaRowT[],
  ) => void;
};

export function DayContent({
  date,
  group,
  habitMap,
  flexProgressByHabitId,
  timeProgressByHabitId,
  streakByHabitId,
  activeTimerHabitId,
  isFuture,
  onRowPress,
  onPillPress,
  onSwipeAction,
  onReorderSection,
}: Props) {
  const iso = isoDate(date);
  const rows = group?.rows ?? [];
  const { notCompleted, completed } = useMemo(
    () => partitionRows(rows, habitMap),
    [rows, habitMap],
  );

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

  const [generation, setGeneration] = useState(0);

  const prevIso = useRef('');
  const prevRows = useRef<AgendaRowT[]>([]);
  const enteringIds = useRef<Set<string>>(new Set());

  if (iso !== prevIso.current) {
    enteringIds.current = diffDayHabits(prevRows.current, rows).entering;
    prevIso.current = iso;
    prevRows.current = rows;
  } else if (rows !== prevRows.current) {
    enteringIds.current = new Set();
    prevRows.current = rows;
  }

  const closeCurrentDrawer = useRef<(() => void) | null>(null);
  const handleDrawerOpen = useCallback((closeFn: () => void) => {
    closeCurrentDrawer.current?.();
    closeCurrentDrawer.current = closeFn;
  }, []);
  const handleDrawerClose = useCallback(() => {
    closeCurrentDrawer.current = null;
  }, []);

  if (rows.length === 0) {
    return (
      <View style={styles.emptyState}>
        <ThemedText style={styles.emptyText}>
          Nothing scheduled for this day.
        </ThemedText>
      </View>
    );
  }

  const keyExtractor = (item: DayItem): string => dayItemKey(item);

  const renderItem = ({ item, drag, isActive }: RenderItemParams<DayItem>) => {
    if (item.kind === 'all-done') {
      return (
        <Animated.View>
          <ThemedText style={styles.allDone}>Everything done for today.</ThemedText>
        </Animated.View>
      );
    }
    if (item.kind === 'completed-header') {
      return (
        <Animated.View style={styles.completedHeader}>
          <View style={styles.completedRule} />
          <ThemedText style={styles.completedLabel}>Completed</ThemedText>
          <View style={styles.completedRule} />
        </Animated.View>
      );
    }
    const habitId =
      item.row.kind === 'completion' ? item.row.habit.id : item.row.habitId;
    const timerStatus: TimerStatus | undefined =
      item.row.habit.unit === 'time'
        ? item.row.kind === 'completion'
          ? 'complete'
          : activeTimerHabitId === habitId
            ? 'running'
            : 'idle'
        : undefined;
    const isEntering = enteringIds.current.has(habitId);
    return (
      <AnimatedHabitRow entering={isEntering}>
        <HabitRowSwipeable
          row={item.row}
          dateIso={iso}
          onPress={onPillPress ? () => onPillPress(item.row, iso) : undefined}
          onTrailingPress={() => onRowPress(item.row, iso)}
          onSwipeAction={(action) => onSwipeAction(item.row, iso, action)}
          onDrawerOpen={handleDrawerOpen}
          onDrawerClose={handleDrawerClose}
          onLongPress={isFuture ? undefined : drag}
          flexProgress={flexProgressByHabitId.get(habitId)}
          timerStatus={timerStatus}
          timeProgress={timeProgressByHabitId.get(habitId)}
          streak={streakByHabitId.get(habitId)}
          isActive={isActive}
          isFuture={isFuture}
        />
      </AnimatedHabitRow>
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
    if (from === to) return;
    const moved = newData[to];
    if (!moved || moved.kind !== 'row') {
      setGeneration((g) => g + 1);
      return;
    }
    let landedSection: Section = 'notCompleted';
    for (let i = 0; i < to; i++) {
      if (newData[i].kind === 'completed-header') {
        landedSection = 'completed';
        break;
      }
    }
    if (landedSection !== moved.section) {
      setGeneration((g) => g + 1);
      return;
    }
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
      onScrollBeginDrag={() => closeCurrentDrawer.current?.()}
      animationConfig={SNAPPY_DROP}
      autoscrollSpeed={0}
      autoscrollThreshold={0}
      enableLayoutAnimationExperimental
      itemLayoutAnimation={LinearTransition.duration(300)}
      containerStyle={styles.scrollRoot}
      contentContainerStyle={styles.scrollContent}
      ItemSeparatorComponent={ItemSeparator}
      keyboardShouldPersistTaps="handled"
      activationDistance={10}
      itemExitingAnimation={FadeOut.duration(200)}
    />
  );
}

const styles = StyleSheet.create({
  scrollRoot: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 120 },
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
