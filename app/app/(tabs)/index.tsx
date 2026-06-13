// Calendar tab — unified entry point that replaces the old Today + History tabs.
// Phase B ships Day, Month, 3-day, Week, and Schedule views.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Palette } from '@/constants/colors';
import { Calendar3DayView } from '@/components/calendar-3day-view';
import { CalendarDayView } from '@/components/calendar-day-view';
import type { ViewMode } from '@/components/calendar-menu-drawer';
import { CompletionToast } from '@/components/completion-toast';
import { useDrawer } from '@/components/drawer-provider';
import { FabSpeedDial } from '@/components/fab-speed-dial';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { CalendarMonthView } from '@/components/calendar-month-view';
import { CalendarScheduleView } from '@/components/calendar-schedule-view';
import { CalendarWeekView } from '@/components/calendar-week-view';
import { TabTopBar } from '@/components/tab-top-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WeekStrip } from '@/components/week-strip';
import { useAuth } from '@/lib/auth';
import { setNavHabit } from '@/lib/habit-nav-cache';
import {
  applySectionReorder,
  canCompleteOn,
  fetchHabits,
  isoDate,
  markFlexCompleted,
  markScheduledCompleted,
  reorderHabits,
  skipOccurrence,
  unmarkCompleted,
  unmarkLastFlexInPeriod,
  unskipOccurrence,
  type Habit,
  type HabitOverride,
} from '@/lib/habits';
import {
  buildDayGroups,
  buildMonthGrid,
  countCompletionsByDate,
  fetchRange,
  flexPeriodStartFor,
  flexProgressByHabit,
  monthLabel,
  nDayRange,
  weekDatesFrom,
  type AgendaRow,
  type CompletionWithHabit,
  type DayGroup,
  type SwipeAction,
} from '@/lib/history';
import {
  fetchMyHabitsStats,
  streaksByHabit,
  type LineageStats,
} from '@/lib/habit-stats';
import { fetchProfile, type Profile } from '@/lib/profile';
import {
  checkAndAutoComplete,
  dateParamsForHabitOn,
  deleteTimeEntries,
  fetchTimeEntries,
  sumDurationSeconds,
  startTimeEntry,
  stopTimeEntry,
} from '@/lib/time-entries';
import { syncWidgetData } from '@/lib/widget-sync';

const SCHEDULE_INITIAL_HALF_WINDOW = 7; // days each direction
const SCHEDULE_EXTEND_BY = 7;

export default function CalendarScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;

  const { view, setView, openDrawer } = useDrawer();
  const today = useMemo(() => new Date(), []);
  const [previousView, setPreviousView] = useState<ViewMode | null>(null);
  const [anchorDate, setAnchorDate] = useState(today);

  // Schedule view tracks its own loaded window (today ± 7 days initially).
  const [scheduleWindow, setScheduleWindow] = useState(() => {
    const from = new Date(today);
    from.setDate(from.getDate() - SCHEDULE_INITIAL_HALF_WINDOW);
    const to = new Date(today);
    to.setDate(to.getDate() + SCHEDULE_INITIAL_HALF_WINDOW + 1);
    return { from: isoDate(from), to: isoDate(to) };
  });

  const [habits, setHabits] = useState<Habit[]>([]);
  const [completions, setCompletions] = useState<CompletionWithHabit[]>([]);
  const [overrides, setOverrides] = useState<HabitOverride[]>([]);
  // Lineage-wide completion/skip history per lineage, used only to derive the
  // 🔥 streak badge on day-view pills. Empty on fetch failure → badges hidden.
  const [statsByLineage, setStatsByLineage] = useState<Map<string, LineageStats>>(new Map());
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const scheduleExtendingRef = useRef(false);

  const [toastVisible, setToastVisible] = useState(false);
  const [toastCompletionId, setToastCompletionId] = useState<string | null>(null);
  const [activeTimerHabitId, setActiveTimerHabitId] = useState<string | null>(null);
  const [activeTimerDateIso, setActiveTimerDateIso] = useState<string | null>(null);
  const activeTimerRef = useRef<{ entryId: string; startedAt: string } | null>(null);
  const [timeBaseByHabitId, setTimeBaseByHabitId] = useState<Map<string, number>>(new Map());
  const [liveElapsed, setLiveElapsed] = useState(0);

  const anchorYear = anchorDate.getFullYear();
  const anchorMonth = anchorDate.getMonth() + 1;
  const weekStart = profile?.week_start ?? 0;

  // Decide what date range to fetch from the server based on the active view.
  const dataRange = useMemo(() => {
    if (view === 'schedule') return scheduleWindow;
    if (view === 'month') {
      const grid = buildMonthGrid(anchorYear, anchorMonth, today);
      const from = grid[0].iso;
      const last = new Date(grid[grid.length - 1].date);
      last.setDate(last.getDate() + 1);
      return { from, to: isoDate(last) };
    }
    const earliest = new Date(anchorDate);
    const latest = new Date(anchorDate);
    if (view === 'week') {
      earliest.setDate(earliest.getDate() - 7);
      latest.setDate(latest.getDate() + 7);
    } else if (view === '3day') {
      latest.setDate(latest.getDate() + 3);
    } else {
      earliest.setDate(earliest.getDate() - 7);
      latest.setDate(latest.getDate() + 7);
    }
    return { from: isoDate(earliest), to: isoDate(latest) };
  }, [view, anchorDate, anchorYear, anchorMonth, today, scheduleWindow]);

  const anchorIso = isoDate(anchorDate);

  const load = useCallback(async () => {
    if (!userId) return;
    const [habitsRes, rangeRes, profileRes, statsRes] = await Promise.all([
      fetchHabits(userId),
      fetchRange(userId, dataRange.from, dataRange.to),
      fetchProfile(userId).catch(() => null),
      fetchMyHabitsStats(userId).catch(() => new Map<string, LineageStats>()),
    ]);
    setHabits(habitsRes);
    setCompletions(rangeRes.completions);
    setOverrides(rangeRes.overrides);
    setStatsByLineage(statsRes);
    if (profileRes) setProfile(profileRes);
    scheduleExtendingRef.current = false;

    const timeHabits = habitsRes.filter((h) => h.unit === 'time' && h.target_seconds);
    const baseTotals = await Promise.all(
      timeHabits.map(async (h) => {
        const { occurrenceDate, periodStart } = dateParamsForHabitOn(h, anchorIso);
        const te = await fetchTimeEntries(h.id, occurrenceDate, periodStart);
        return [h.id, sumDurationSeconds(te)] as const;
      }),
    );
    setTimeBaseByHabitId(new Map(baseTotals));
  }, [userId, dataRange.from, dataRange.to, anchorIso]);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      load().finally(() => setLoading(false));
      syncWidgetData(userId);
    }, [userId, load]),
  );

  useEffect(() => {
    async function restoreTimer() {
      const keys = await AsyncStorage.getAllKeys();
      const timerKeys = keys.filter((k) => k.startsWith('timer:'));
      for (const key of timerKeys) {
        const stored = await AsyncStorage.getItem(key);
        if (!stored) continue;
        const parsed = JSON.parse(stored);
        const habitId = key.split(':')[1];
        if (!habits.some((h) => h.id === habitId)) continue;
        activeTimerRef.current = parsed;
        setActiveTimerHabitId(habitId);
        setActiveTimerDateIso(parsed.dateIso ?? isoDate(new Date()));
        return;
      }
    }
    if (habits.length > 0) restoreTimer();
  }, [habits]);

  useEffect(() => {
    if (!activeTimerHabitId || !activeTimerRef.current) {
      setLiveElapsed(0);
      return;
    }
    const startMs = new Date(activeTimerRef.current.startedAt).getTime();
    const tick = () => setLiveElapsed(Math.floor((Date.now() - startMs) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeTimerHabitId]);

  const timeProgressByHabitId = useMemo(() => {
    const map = new Map<string, number>();
    for (const h of habits) {
      if (h.unit !== 'time' || !h.target_seconds) continue;
      const base = timeBaseByHabitId.get(h.id) ?? 0;
      const timerOnThisDay =
        h.id === activeTimerHabitId && activeTimerDateIso === anchorIso;
      const elapsed = timerOnThisDay ? liveElapsed : 0;
      map.set(h.id, Math.min(1, (base + elapsed) / h.target_seconds));
    }
    return map;
  }, [habits, timeBaseByHabitId, activeTimerHabitId, activeTimerDateIso, anchorIso, liveElapsed]);

  // The days the active view needs to render.
  const daysInRange = useMemo(() => {
    if (view === 'month') {
      const grid = buildMonthGrid(anchorYear, anchorMonth, today);
      return grid.map((c) => c.iso);
    }
    if (view === 'day') {
      return [isoDate(anchorDate)];
    }
    if (view === '3day') {
      return nDayRange(anchorDate, 3);
    }
    if (view === 'week') {
      return weekDatesFrom(anchorDate, weekStart);
    }
    if (view === 'schedule') {
      const days: string[] = [];
      const cursor = parseIsoLocal(scheduleWindow.from);
      const end = parseIsoLocal(scheduleWindow.to);
      while (cursor < end) {
        days.push(isoDate(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
      return days;
    }
    return [];
  }, [view, anchorDate, anchorYear, anchorMonth, today, weekStart, scheduleWindow]);

  const dayGroups = useMemo(
    () =>
      buildDayGroups(
        daysInRange,
        habits,
        completions,
        overrides,
        today,
      ),
    [daysInRange, habits, completions, overrides, today],
  );

  // Day-by-day completion counts across the fetched window, used to fill the
  // week-strip cells. Computed directly from completions so we don't need to
  // build DayGroups for the 21-day strip range separately.
  const completionCountByIso = useMemo(
    () => countCompletionsByDate(completions),
    [completions],
  );

  // Per-flex-habit progress through the current period (day/week/month). Drives
  // the trailing mini ring on flex completion pills.
  const flexProgressByHabitId = useMemo(
    () => flexProgressByHabit(habits, completions, today),
    [habits, completions, today],
  );

  // Current streak per habit, derived from the batched lineage history. Memoized
  // so it recomputes only when habits/stats change — never on render (this is
  // the client-side compute path; see lib/habit-stats.ts streaksByHabit).
  const streakByHabitId = useMemo(
    () => streaksByHabit(habits, statsByLineage, today),
    [habits, statsByLineage, today],
  );

  const groupByIso = useMemo(() => {
    const m = new Map<string, DayGroup>();
    for (const g of dayGroups) m.set(g.date, g);
    return m;
  }, [dayGroups]);

  // ─── Handlers ──────────────────────────────────────────────────────────

  function stepAnchor(direction: 1 | -1) {
    const d = new Date(anchorDate);
    switch (view) {
      case 'day':
        d.setDate(d.getDate() + direction);
        break;
      case '3day':
        d.setDate(d.getDate() + direction * 3);
        break;
      case 'week':
        d.setDate(d.getDate() + direction * 7);
        break;
      case 'month':
        d.setMonth(d.getMonth() + direction);
        break;
      default:
        return;
    }
    setAnchorDate(d);
  }

  function jumpToToday() {
    setPreviousView(null);
    setAnchorDate(new Date());
    // Re-seed the schedule window so today is centered.
    const t = new Date();
    const from = new Date(t);
    from.setDate(from.getDate() - SCHEDULE_INITIAL_HALF_WINDOW);
    const to = new Date(t);
    to.setDate(to.getDate() + SCHEDULE_INITIAL_HALF_WINDOW + 1);
    setScheduleWindow({ from: isoDate(from), to: isoDate(to) });
  }

  function onMonthCellTap(iso: string) {
    setPreviousView('month');
    setAnchorDate(parseIsoLocal(iso));
    setView('day');
  }

  function onWeekColumnTap(iso: string) {
    setPreviousView('week');
    setAnchorDate(parseIsoLocal(iso));
    setView('day');
  }

  function onBack() {
    if (!previousView) return;
    setView(previousView);
    setPreviousView(null);
  }

  async function handleTrailingPress(row: AgendaRow, dateIso: string) {
    if (!userId) return;
    if (!canCompleteOn(dateIso, today)) return;

    const habitId = row.kind === 'completion' ? row.habit.id : row.habitId;
    const habit = habits.find((h) => h.id === habitId);

    if (habit?.unit === 'time') {
      await handleTimerToggle(habit, dateIso);
      return;
    }

    let completionId: string | undefined;
    if (row.kind === 'scheduled') {
      completionId = await markScheduledCompleted(row.habitId, userId, dateIso);
    } else if (row.kind === 'flex') {
      completionId = await markFlexCompleted(row.habitId, userId);
    }
    if (completionId) {
      setToastCompletionId(completionId);
      setToastVisible(true);
    }
    await load();
  }

  async function handleTimerToggle(habit: Habit, dateIso: string) {
    if (!userId) return;
    const { occurrenceDate, periodStart } = dateParamsForHabitOn(habit, dateIso);
    const key = `timer:${habit.id}:${occurrenceDate ?? periodStart}`;

    if (activeTimerHabitId === habit.id && activeTimerRef.current) {
      await stopTimeEntry(activeTimerRef.current.entryId, activeTimerRef.current.startedAt);
      await AsyncStorage.removeItem(key);
      activeTimerRef.current = null;
      setTimeBaseByHabitId((prev) => {
        const next = new Map(prev);
        next.set(habit.id, (prev.get(habit.id) ?? 0) + liveElapsed);
        return next;
      });
      setActiveTimerHabitId(null);
      setActiveTimerDateIso(null);
      await checkAndAutoComplete(habit.id, userId, habit, occurrenceDate, periodStart);
      await load();
    } else {
      if (activeTimerHabitId && activeTimerRef.current) {
        const prevHabit = habits.find((h) => h.id === activeTimerHabitId);
        if (prevHabit && activeTimerDateIso) {
          const prev = dateParamsForHabitOn(prevHabit, activeTimerDateIso);
          const prevKey = `timer:${prevHabit.id}:${prev.occurrenceDate ?? prev.periodStart}`;
          await stopTimeEntry(activeTimerRef.current.entryId, activeTimerRef.current.startedAt);
          await AsyncStorage.removeItem(prevKey);
          setTimeBaseByHabitId((p) => {
            const next = new Map(p);
            next.set(prevHabit.id, (p.get(prevHabit.id) ?? 0) + liveElapsed);
            return next;
          });
          await checkAndAutoComplete(prevHabit.id, userId, prevHabit, prev.occurrenceDate, prev.periodStart);
        }
      }
      const { id, startedAt } = await startTimeEntry(habit.id, userId, occurrenceDate, periodStart);
      activeTimerRef.current = { entryId: id, startedAt };
      setActiveTimerHabitId(habit.id);
      setActiveTimerDateIso(dateIso);
      await AsyncStorage.setItem(key, JSON.stringify({ entryId: id, startedAt, dateIso }));
    }
  }

  function handlePillPress(row: AgendaRow, dateIso: string) {
    const habitId = row.kind === 'completion' ? row.habit.id : row.habitId;
    const habit = habits.find((h) => h.id === habitId);
    if (habit) setNavHabit(habit);
    router.push({
      pathname: '/habit/view',
      params: { id: habitId, occurrenceDate: dateIso },
    });
  }

  async function handleSwipeAction(
    row: AgendaRow,
    dateIso: string,
    action: SwipeAction,
  ) {
    if (!userId) return;
    if (action === 'reset') {
      if (row.kind === 'scheduled' && row.habit.unit === 'time') {
        const habit = habits.find((h) => h.id === row.habitId);
        if (!habit) return;
        if (activeTimerHabitId === habit.id && activeTimerRef.current) {
          const { occurrenceDate, periodStart } = dateParamsForHabitOn(habit, dateIso);
          const key = `timer:${habit.id}:${occurrenceDate ?? periodStart}`;
          await stopTimeEntry(activeTimerRef.current.entryId, activeTimerRef.current.startedAt);
          await AsyncStorage.removeItem(key);
          activeTimerRef.current = null;
          setActiveTimerHabitId(null);
          setActiveTimerDateIso(null);
        }
        const { occurrenceDate, periodStart } = dateParamsForHabitOn(habit, dateIso);
        await deleteTimeEntries(habit.id, occurrenceDate, periodStart);
      } else if (row.kind === 'completion') {
        await unmarkCompleted(row.id);
      } else if (row.kind === 'skip') {
        await unskipOccurrence(row.habitId, dateIso);
      } else if (row.kind === 'flex' && row.count > 0) {
        const habit = habits.find((h) => h.id === row.habitId);
        if (!habit?.target_period) return;
        const periodStart = flexPeriodStartFor(dateIso, habit.target_period);
        await unmarkLastFlexInPeriod(row.habitId, periodStart);
      }
    } else if (action === 'skip') {
      if (row.kind === 'scheduled') {
        await skipOccurrence(row.habitId, dateIso);
      }
    }
    await load();
  }

  // Reorder happens within a section on a specific day. We only renumber the
  // habits in that section, preserving the relative order of every other
  // habit. The schedule view shows many days at once, so the previous
  // approach (yanking every habit visible on the tapped day to the front of
  // the global list) caused rows on other days to jump around.
  async function handleReorderSection(
    dateIso: string,
    section: 'notCompleted' | 'completed',
    newRows: AgendaRow[],
  ) {
    const newSectionIds = newRows.map((r) =>
      r.kind === 'completion' ? r.habit.id : r.habitId,
    );

    const updatedHabits = applySectionReorder(habits, newSectionIds);
    setHabits(updatedHabits);

    const globalOrder = updatedHabits.map((h) => h.id);
    reorderHabits(globalOrder).catch((err) => {
      console.warn('Reorder failed, refetching', err);
      load();
    });
  }

  function onScheduleLoadEarlier() {
    if (scheduleExtendingRef.current) return;
    scheduleExtendingRef.current = true;
    setScheduleWindow((w) => {
      const fromDate = parseIsoLocal(w.from);
      fromDate.setDate(fromDate.getDate() - SCHEDULE_EXTEND_BY);
      return { from: isoDate(fromDate), to: w.to };
    });
  }

  function onScheduleLoadMore() {
    if (scheduleExtendingRef.current) return;
    scheduleExtendingRef.current = true;
    setScheduleWindow((w) => {
      const toDate = parseIsoLocal(w.to);
      toDate.setDate(toDate.getDate() + SCHEDULE_EXTEND_BY);
      return { from: w.from, to: isoDate(toDate) };
    });
  }

  // ─── Render ────────────────────────────────────────────────────────────

  const isOnToday = isoDate(anchorDate) === isoDate(today);
  const showBack =
    view === 'day' && (previousView === 'month' || previousView === 'week');

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.content}>
        <TabTopBar
          title={headerLabel(view, anchorDate, weekStart)}
          onMenuPress={openDrawer}
          rightSlot={
            !isOnToday ? (
              <Pressable onPress={jumpToToday} hitSlop={8}>
                <ThemedText style={styles.todayBtn}>Today</ThemedText>
              </Pressable>
            ) : undefined
          }
        />

        {/* Day view: optional back-to-prev-view affordance, then the week strip. */}
        {view === 'day' && showBack && (
          <View style={styles.subBar}>
            <Pressable onPress={onBack} hitSlop={12} style={styles.subSide}>
              <ThemedText style={styles.backText}>
                ‹ {previousView === 'month'
                  ? monthLabel(anchorYear, anchorMonth)
                  : 'Week'}
              </ThemedText>
            </Pressable>
            <View style={styles.subSpacer} />
          </View>
        )}
        {view === 'day' && (
          <WeekStrip
            anchorDate={anchorDate}
            weekStart={weekStart}
            today={today}
            countByDate={completionCountByIso}
            onSelect={setAnchorDate}
          />
        )}

        {/* Other views: keep the step-arrow sub-bar. */}
        {view !== 'day' && view !== 'schedule' && (
          <View style={styles.subBar}>
            <Pressable
              onPress={() => stepAnchor(-1)}
              hitSlop={16}
              style={styles.subSide}>
              <ThemedText style={styles.arrow}>‹</ThemedText>
            </Pressable>
            <View style={styles.subSpacer} />
            <Pressable
              onPress={() => stepAnchor(1)}
              hitSlop={16}
              style={styles.subSideRight}>
              <ThemedText style={styles.arrow}>›</ThemedText>
            </Pressable>
          </View>
        )}

        {/* Body */}
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator />
          </View>
        ) : view === 'day' ? (
          <CalendarDayView
            anchorDate={anchorDate}
            today={today}
            habits={habits}
            dayGroups={dayGroups}
            flexProgressByHabitId={flexProgressByHabitId}
            timeProgressByHabitId={timeProgressByHabitId}
            streakByHabitId={streakByHabitId}
            activeTimerHabitId={activeTimerHabitId}
            onRowPress={handleTrailingPress}
            onPillPress={handlePillPress}
            onSwipeAction={handleSwipeAction}
            onReorderSection={handleReorderSection}
          />
        ) : view === '3day' ? (
          <Calendar3DayView
            anchorDate={anchorDate}
            habits={habits}
            dayGroups={dayGroups}
            onRowPress={handlePillPress}
          />
        ) : view === 'week' ? (
          <CalendarWeekView
            anchorDate={anchorDate}
            weekStart={weekStart}
            habits={habits}
            dayGroups={dayGroups}
            onColumnPress={onWeekColumnTap}
            onRowPress={handlePillPress}
          />
        ) : view === 'month' ? (
          <CalendarMonthView
            cells={buildMonthGrid(anchorYear, anchorMonth, today)}
            groupByIso={groupByIso}
            selectedIso={null}
            onSelectDay={onMonthCellTap}
          />
        ) : view === 'schedule' ? (
          <CalendarScheduleView
            dayGroups={dayGroups}
            habits={habits}
            todayIso={isoDate(today)}
            flexProgressByHabitId={flexProgressByHabitId}
            onLoadEarlier={onScheduleLoadEarlier}
            onLoadMore={onScheduleLoadMore}
            onRowPress={handleTrailingPress}
            onPillPress={handlePillPress}
            onSwipeAction={handleSwipeAction}
            onReorderSection={handleReorderSection}
          />
        ) : null}

        <FabSpeedDial
          actions={[
            {
              key: 'new-habit',
              label: 'New habit',
              icon: <IconSymbol name="plus.circle" size={20} color={Palette.primary} />,
              onPress: () => router.push('/habit/new'),
            },
            {
              key: 'feedback',
              label: 'Feedback',
              icon: <IconSymbol name="bubble.left" size={20} color={Palette.blush} />,
              onPress: () => router.push('/feedback'),
            },
          ]}
        />
      </SafeAreaView>

      <CompletionToast
        visible={toastVisible}
        onPress={() => {
          if (toastCompletionId) router.push(`/completion/${toastCompletionId}`);
        }}
        onDismiss={() => setToastVisible(false)}
      />
    </ThemedView>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function headerLabel(view: ViewMode, anchor: Date, weekStart: number): string {
  switch (view) {
    case 'day':
      return anchor.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    case '3day': {
      const days = nDayRange(anchor, 3);
      const start = parseIsoLocal(days[0]);
      const end = parseIsoLocal(days[2]);
      return `${shortMd(start)} – ${shortMd(end)}`;
    }
    case 'week': {
      const wk = weekDatesFrom(anchor, weekStart);
      const start = parseIsoLocal(wk[0]);
      const end = parseIsoLocal(wk[6]);
      return `${shortMd(start)} – ${shortMd(end)}`;
    }
    case 'month':
      return anchor.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      });
    case 'schedule':
      return 'Schedule';
  }
}

function shortMd(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function parseIsoLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

// ─── Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
  todayBtn: { fontSize: 14, color: Palette.lavender, fontWeight: '600' },
  subBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  subSide: { minWidth: 40, alignItems: 'flex-start' },
  subSideRight: { minWidth: 40, alignItems: 'flex-end' },
  subSpacer: { flex: 1 },
  arrow: { fontSize: 26, opacity: 0.6 },
  backText: { fontSize: 15, opacity: 0.85 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
