import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, useColorScheme } from 'react-native';
import DraggableFlatList, {
  type RenderItemParams,
} from 'react-native-draggable-flatlist';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';

import { AnimatedHabitRow } from '@/components/animated-habit-row';
import { GroupCardHeader, groupCardSurface } from '@/components/group-card-header';
import { HabitRowSwipeable } from '@/components/habit-row-swipeable';
import type { TimerStatus } from '@/components/time-trailing-icon';
import { ThemedText } from '@/components/themed-text';
import { useTokens } from '@/hooks/use-tokens';
import { diffDayHabits } from '@/lib/day-diff';
import { buildDayItems, UNGROUPED } from '@/lib/day-items';
import { Radii } from '@/constants/theme';
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
  const t = useTokens();
  const isDark = useColorScheme() !== 'light';
  // Identity color per group id — tints the card surface (header handles its
  // own bg; rows and footer read from here).
  const colorByGroupId = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const g of groups) m.set(g.id, g.color);
    return m;
  }, [groups]);

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

  // Group expansion: rows mounting because a card just expanded wait out the
  // 300ms layout transition (AnimatedHabitRow's delayed FadeIn) instead of
  // popping in while the card is still growing.
  const justExpandedGroup = useRef<string | null>(null);

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
        <ThemedText style={[styles.emptyText, { color: t.ink52 }]}>
          Nothing scheduled for this day.
        </ThemedText>
      </View>
    );
  }

  const keyExtractor = (item: DayItem): string => dayItemKey(item);

  const renderItem = ({ item, drag, isActive, getIndex }: RenderItemParams<DayItem>) => {
    if (item.kind === 'group-header') {
      return (
        <Animated.View>
          <GroupCardHeader
            groupId={item.groupId}
            name={item.name}
            collapsed={item.collapsed}
            color={item.color}
            streak={item.streak}
            onToggle={() => {
              if (item.collapsed) {
                justExpandedGroup.current = item.groupId;
                setTimeout(() => {
                  if (justExpandedGroup.current === item.groupId) {
                    justExpandedGroup.current = null;
                  }
                }, 700);
              }
              onToggleGroup(item.groupId, !item.collapsed);
            }}
          />
        </Animated.View>
      );
    }
    if (item.kind === 'group-footer') {
      // Collapsed: the header renders as a full pill, so the footer is pure
      // spacing between cards — no band, no dead zone.
      if (item.collapsed) {
        return <Animated.View style={styles.groupGap} />;
      }
      // Expanded: the bottom cap of the card. Height ≥ the corner radius —
      // iOS clamps a radius to its edge, so a short cap renders visibly
      // tighter corners than the header (the mismatched-radii bug). Tapping
      // the cap collapses the card, so the card's own chrome is never a dead
      // zone.
      return (
        <Animated.View>
          <Pressable
            onPress={() => onToggleGroup(item.groupId, true)}
            accessibilityRole="button"
            accessibilityLabel="Collapse"
            style={[
              styles.groupFooter,
              {
                backgroundColor: groupCardSurface(item.color, isDark, t.surface),
                borderBottomLeftRadius: Radii.card,
                borderBottomRightRadius: Radii.card,
              },
            ]}
          />
        </Animated.View>
      );
    }
    if (item.kind === 'ungrouped-header') {
      // Boundary between the group cards and the ungrouped pile. Kept as a
      // data item (drag-reorder walks it to attribute drops) but rendered as
      // plain breathing room — the cards' contained shape vs the full-width
      // loose pills already tells the two regions apart.
      return <Animated.View style={styles.ungroupedHeader} />;
    }
    if (item.kind === 'all-done') {
      return (
        <Animated.View>
          <ThemedText style={[styles.allDone, { color: t.ink52 }]}>Everything done for today.</ThemedText>
        </Animated.View>
      );
    }
    if (item.kind === 'completed-header') {
      return (
        <Animated.View style={styles.sectionHeader}>
          <View style={[styles.rule, { backgroundColor: t.hairlineStrong }]} />
          <ThemedText style={[styles.sectionLabel, { color: t.ink52 }]}>Completed</ThemedText>
          <View style={[styles.rule, { backgroundColor: t.hairlineStrong }]} />
        </Animated.View>
      );
    }
    if (item.kind === 'resting-header') {
      const expanded = restingExpanded.has(item.groupId);
      const inCard = item.groupId !== UNGROUPED;
      const restingBg = groupCardSurface(colorByGroupId.get(item.groupId), isDark, t.surface);
      return (
        <Pressable
          onPress={() => toggleResting(item.groupId)}
          style={[styles.sectionHeader, inCard && [styles.cardInset, { backgroundColor: restingBg }]]}
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Collapse resting' : 'Expand resting'}>
          <View style={[styles.rule, { backgroundColor: t.hairlineStrong }]} />
          <ThemedText style={[styles.sectionLabel, { color: t.ink52 }]}>Resting</ThemedText>
          <ThemedText style={[styles.zzz, { color: t.ink45 }]}>zᶻᶻ</ThemedText>
          <ThemedText style={[styles.restChevron, { color: t.ink52 }]}>{expanded ? '▾' : '▸'}</ThemedText>
          <View style={[styles.rule, { backgroundColor: t.hairlineStrong }]} />
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
    const fromExpand = item.groupId === justExpandedGroup.current;
    const cardBg = groupCardSurface(colorByGroupId.get(item.groupId), isDark, t.surface);
    const isEntering = enteringIds.current.has(habitId) || fromExpand;
    // Cascade: rows of a just-expanded card start almost with the layout
    // transition and stagger downward, so the card rolls open instead of
    // sitting empty until one big fade (position within the card, capped).
    let enterDelay: number | undefined;
    if (fromExpand) {
      const headerIdx = data.findIndex(
        (d) => d.kind === 'group-header' && d.groupId === item.groupId,
      );
      const myIdx = getIndex() ?? data.indexOf(item);
      const ordinal = headerIdx >= 0 && myIdx > headerIdx ? myIdx - headerIdx - 1 : 0;
      enterDelay = Math.min(120 + ordinal * 45, 500);
    }
    const inCard = item.groupId !== UNGROUPED;
    return (
      <View
        style={
          inCard ? [styles.cardRow, { backgroundColor: cardBg }] : styles.looseRow
        }>
      <AnimatedHabitRow entering={isEntering} enterDelay={enterDelay}>
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
      </View>
    );
  };

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
      if (it.kind === 'group-footer') {
        continue; // card cap — attribution unchanged
      } else if (it.kind === 'group-header') {
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
      // Render the whole day in one pass and keep a huge window: the trailing
      // cells otherwise get unmounted/remounted by list windowing when an
      // expand grows the data, which plays the exiting fade instead of the
      // layout slide (the "completed habit fades instead of sliding" bug).
      // Day lists are small, so opting out of virtualization is free.
      initialNumToRender={40}
      maxToRenderPerBatch={40}
      windowSize={41}
      // Anchor the first visible item when content above it grows or shrinks:
      // collapsing a card removes its rows from layout in one frame, and
      // without anchoring the stale scroll offset points at different content
      // (worst case clamped to the top). With it, expand/collapse only ever
      // reads as the cards sliding.
      maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
      enableLayoutAnimationExperimental
      itemLayoutAnimation={LinearTransition.duration(300)}
      containerStyle={styles.scrollRoot}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      activationDistance={10}
      itemExitingAnimation={FadeOut.duration(200)}
    />
  );
}

const styles = StyleSheet.create({
  scrollRoot: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 120 },
  // In-card rows sit inset on the card surface — narrower than ungrouped
  // pills, so containment reads at a glance; the padding doubles as the gap.
  cardRow: { paddingHorizontal: 10, paddingBottom: 10 },
  cardInset: { paddingHorizontal: 14, marginHorizontal: 0 },
  looseRow: { marginBottom: 10 },
  groupFooter: { height: Radii.card, marginBottom: 14 },
  groupGap: { height: 14 },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: { fontSize: 15 },
  allDone: { paddingVertical: 16, fontSize: 14 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  rule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  sectionLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  zzz: { fontSize: 12, fontStyle: 'italic' },
  restChevron: { fontSize: 12 },
  ungroupedHeader: { height: 4 },
});
