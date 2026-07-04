import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import DraggableFlatList, {
  type RenderItemParams,
} from 'react-native-draggable-flatlist';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';

import { AnimatedHabitRow } from '@/components/animated-habit-row';
import { GroupCardHeader } from '@/components/group-card-header';
import { HabitRowSwipeable } from '@/components/habit-row-swipeable';
import type { TimerStatus } from '@/components/time-trailing-icon';
import { ThemedText } from '@/components/themed-text';
import { diffDayHabits } from '@/lib/day-diff';
import { buildDayItems, UNGROUPED } from '@/lib/day-items';
import { dayItemKey, type DayItem, type Section } from '@/lib/day-item-key';
import type { GroupMembership, HabitGroup } from '@/lib/groups';
import { isoDate, type Habit } from '@/lib/habits';
import {
  type AgendaRow as AgendaRowT,
  type DayGroup,
  type SwipeAction,
} from '@/lib/history';

const SNAPPY_DROP = { damping: 30, stiffness: 700, mass: 0.6 };

type Props = {
  date: Date;
  group: DayGroup | undefined;
  habitMap: Map<string, Habit>;
  groups: HabitGroup[];
  memberships: GroupMembership[];
  collapsedById: Map<string, boolean>;
  streakByGroupId?: Map<string, number>;
  flexProgressByHabitId: Map<string, { count: number; target: number }>;
  timeProgressByHabitId: Map<string, number>;
  streakByHabitId: Map<string, number>;
  activeTimerHabitId?: string | null;
  isFuture: boolean;
  onRowPress: (row: AgendaRowT, dateIso: string) => void;
  onPillPress?: (row: AgendaRowT, dateIso: string) => void;
  onSwipeAction: (row: AgendaRowT, dateIso: string, action: SwipeAction) => void;
  onToggleGroup: (groupId: string, collapsed: boolean) => void;
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
  groups,
  memberships,
  collapsedById,
  streakByGroupId,
  flexProgressByHabitId,
  timeProgressByHabitId,
  streakByHabitId,
  activeTimerHabitId,
  isFuture,
  onRowPress,
  onPillPress,
  onSwipeAction,
  onToggleGroup,
  onReorderSection,
}: Props) {
  const iso = isoDate(date);
  const rows = group?.rows ?? [];

  // Per-section (group-scoped) Resting expand state, keyed by group id / UNGROUPED.
  const [restingExpanded, setRestingExpanded] = useState<Set<string>>(new Set());
  const toggleResting = useCallback((key: string) => {
    setRestingExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const data = useMemo<DayItem[]>(
    () =>
      buildDayItems({
        rows,
        habitMap,
        groups,
        memberships,
        dateIso: iso,
        restingExpanded,
        collapsedById,
        streakByGroupId,
      }),
    [rows, habitMap, groups, memberships, iso, restingExpanded, collapsedById, streakByGroupId],
  );

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
    if (item.kind === 'group-header') {
      return (
        <Animated.View>
          <GroupCardHeader
            groupId={item.groupId}
            name={item.name}
            collapsed={item.collapsed}
            color={item.color}
            streak={item.streak}
            onToggle={() => onToggleGroup(item.groupId, !item.collapsed)}
          />
        </Animated.View>
      );
    }
    if (item.kind === 'ungrouped-header') {
      // Subtle divider marking the start of the ungrouped habits below the cards.
      return (
        <Animated.View style={styles.ungroupedHeader}>
          <View style={styles.rule} />
        </Animated.View>
      );
    }
    if (item.kind === 'all-done') {
      return (
        <Animated.View>
          <ThemedText style={styles.allDone}>Everything done for today.</ThemedText>
        </Animated.View>
      );
    }
    if (item.kind === 'completed-header') {
      return (
        <Animated.View style={styles.sectionHeader}>
          <View style={styles.rule} />
          <ThemedText style={styles.sectionLabel}>Completed</ThemedText>
          <View style={styles.rule} />
        </Animated.View>
      );
    }
    if (item.kind === 'resting-header') {
      const expanded = restingExpanded.has(item.groupId);
      return (
        <Pressable
          onPress={() => toggleResting(item.groupId)}
          style={styles.sectionHeader}
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Collapse resting' : 'Expand resting'}>
          <View style={styles.rule} />
          <ThemedText style={styles.sectionLabel}>Resting</ThemedText>
          <ThemedText style={styles.zzz}>zᶻᶻ</ThemedText>
          <ThemedText style={styles.restChevron}>{expanded ? '▾' : '▸'}</ThemedText>
          <View style={styles.rule} />
        </Pressable>
      );
    }
    const isResting = item.section === 'resting';
    const habitId =
      item.row.kind === 'completion' ? item.row.habit.id : item.row.habitId;
    const timerStatus: TimerStatus | undefined =
      item.row.habit.unit === 'time' && item.row.kind !== 'rest'
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
          onLongPress={isFuture || isResting ? undefined : drag}
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
    if (!moved || moved.kind !== 'row' || moved.section === 'resting') {
      setGeneration((g) => g + 1);
      return;
    }
    // Determine which group + section the row landed in by walking the headers
    // above it. A group-header / ungrouped-header opens a new group (section
    // resets to not-completed); completed/resting headers switch the section.
    let landedGroup = UNGROUPED;
    let landedSection: Section = 'notCompleted';
    for (let i = 0; i < to; i++) {
      const it = newData[i];
      if (it.kind === 'group-header') {
        landedGroup = it.groupId;
        landedSection = 'notCompleted';
      } else if (it.kind === 'ungrouped-header') {
        landedGroup = UNGROUPED;
        landedSection = 'notCompleted';
      } else if (it.kind === 'completed-header') landedSection = 'completed';
      else if (it.kind === 'resting-header') landedSection = 'resting';
    }
    // Reject drops that cross a group or section boundary — reorder is in-place.
    if (landedGroup !== moved.groupId || landedSection !== moved.section) {
      setGeneration((g) => g + 1);
      return;
    }
    // Collect the new order of this group+section's rows (their groupId/section
    // fields are unchanged by the drag, so filtering by them is correct).
    const sectionRows: AgendaRowT[] = [];
    for (const it of newData) {
      if (it.kind === 'row' && it.groupId === moved.groupId && it.section === moved.section) {
        sectionRows.push(it.row);
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  rule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(127,127,127,0.3)',
  },
  sectionLabel: {
    fontSize: 12,
    opacity: 0.55,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  zzz: { fontSize: 12, opacity: 0.5, fontStyle: 'italic' },
  restChevron: { fontSize: 12, opacity: 0.55 },
  ungroupedHeader: { paddingTop: 18, paddingBottom: 4 },
});
