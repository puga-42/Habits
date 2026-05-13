import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HabitFilter } from '@/components/habit-filter';
import { HistoryAgenda } from '@/components/history-agenda';
import { HistoryCalendar } from '@/components/history-calendar';
import { MonthPicker } from '@/components/month-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/lib/auth';
import {
  fetchHabits,
  type Habit,
  type HabitOverride,
} from '@/lib/habits';
import {
  agendaDatesForMonth,
  buildDayGroups,
  buildMonthGrid,
  fetchMonth,
  monthLabel,
  nextMonth,
  prevMonth,
  type CompletionWithHabit,
} from '@/lib/history';

export default function HistoryScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;

  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [selectedIso, setSelectedIso] = useState<string | null>(null);

  const [habits, setHabits] = useState<Habit[]>([]);
  const [completions, setCompletions] = useState<CompletionWithHabit[]>([]);
  const [overrides, setOverrides] = useState<HabitOverride[]>([]);
  const [filterHabitId, setFilterHabitId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    const [habitsRes, monthRes] = await Promise.all([
      fetchHabits(userId),
      fetchMonth(userId, year, month),
    ]);
    setHabits(habitsRes);
    setCompletions(monthRes.completions);
    setOverrides(monthRes.overrides);
  }, [userId, year, month]);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      load().finally(() => setLoading(false));
    }, [userId, load]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function goPrevMonth() {
    const next = prevMonth(year, month);
    setYear(next.year);
    setMonth(next.month);
    setSelectedIso(null);
    setLoading(true);
  }

  function goNextMonth() {
    const next = nextMonth(year, month);
    setYear(next.year);
    setMonth(next.month);
    setSelectedIso(null);
    setLoading(true);
  }

  function pickMonth(y: number, m: number) {
    setYear(y);
    setMonth(m);
    setSelectedIso(null);
    setMonthPickerOpen(false);
    setLoading(true);
  }

  // Apply the habit filter client-side across habits, completions, and overrides.
  const filteredHabits = useMemo(
    () => (filterHabitId ? habits.filter((h) => h.id === filterHabitId) : habits),
    [filterHabitId, habits],
  );
  const filteredCompletions = useMemo(
    () =>
      filterHabitId
        ? completions.filter((c) => c.habit_id === filterHabitId)
        : completions,
    [filterHabitId, completions],
  );
  const filteredOverrides = useMemo(
    () =>
      filterHabitId
        ? overrides.filter((o) => o.habit_id === filterHabitId)
        : overrides,
    [filterHabitId, overrides],
  );

  const cells = useMemo(() => buildMonthGrid(year, month, today), [year, month, today]);
  const agendaDates = useMemo(() => agendaDatesForMonth(year, month), [year, month]);
  const dayGroups = useMemo(
    () =>
      buildDayGroups(
        agendaDates,
        filteredHabits,
        filteredCompletions,
        filteredOverrides,
        today,
      ),
    [agendaDates, filteredHabits, filteredCompletions, filteredOverrides, today],
  );

  // Calendar dots = any day with at least one rendered row (completion,
  // scheduled, or skip). Derived from dayGroups for a single source of truth.
  const activityDates = useMemo(() => {
    const s = new Set<string>();
    for (const g of dayGroups) {
      if (g.rows.length > 0) s.add(g.date);
    }
    return s;
  }, [dayGroups]);

  // The selected habit (for the filter chip label).
  const selectedHabit = filterHabitId ? habits.find((h) => h.id === filterHabitId) : null;
  const filterLabel = selectedHabit
    ? `${selectedHabit.icon ? selectedHabit.icon + ' ' : ''}${selectedHabit.title}`
    : 'All habits';

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.content}>
        {/* Month header */}
        <View style={styles.header}>
          <Pressable onPress={goPrevMonth} hitSlop={16} style={styles.headerArrow}>
            <ThemedText style={styles.arrow}>‹</ThemedText>
          </Pressable>
          <Pressable
            onPress={() => setMonthPickerOpen(true)}
            hitSlop={8}
            style={styles.monthLabelWrap}>
            <ThemedText type="defaultSemiBold" style={styles.monthLabel}>
              {monthLabel(year, month)} ▾
            </ThemedText>
          </Pressable>
          <Pressable onPress={goNextMonth} hitSlop={16} style={styles.headerArrow}>
            <ThemedText style={styles.arrow}>›</ThemedText>
          </Pressable>
        </View>

        {/* Calendar */}
        <View style={styles.calendarWrap}>
          <HistoryCalendar
            cells={cells}
            activityDates={activityDates}
            selectedIso={selectedIso}
            onSelectDay={setSelectedIso}
          />
        </View>

        {/* Filter chip */}
        <View style={styles.filterRow}>
          <ThemedText style={styles.filterLabel}>Filter:</ThemedText>
          <Pressable
            onPress={() => setFilterOpen(true)}
            style={({ pressed }) => [styles.filterChip, pressed && styles.filterChipPressed]}>
            <ThemedText style={styles.filterChipText} numberOfLines={1}>
              {filterLabel}
            </ThemedText>
            <ThemedText style={styles.filterChipChevron}>▾</ThemedText>
          </Pressable>
        </View>

        {/* Agenda or loading state */}
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator />
          </View>
        ) : (
          <View style={styles.agendaContainer}>
            <HistoryAgenda
              groups={dayGroups}
              scrollToIso={selectedIso}
              refreshing={refreshing}
              onRefresh={onRefresh}
            />
          </View>
        )}
      </SafeAreaView>

      <MonthPicker
        visible={monthPickerOpen}
        year={year}
        month={month}
        onPick={pickMonth}
        onClose={() => setMonthPickerOpen(false)}
      />
      <HabitFilter
        visible={filterOpen}
        habits={habits}
        selectedHabitId={filterHabitId}
        onPick={setFilterHabitId}
        onClose={() => setFilterOpen(false)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerArrow: {
    width: 44,
    alignItems: 'center',
  },
  arrow: { fontSize: 26, opacity: 0.6 },
  monthLabelWrap: { flex: 1, alignItems: 'center' },
  monthLabel: { fontSize: 18 },
  calendarWrap: { paddingHorizontal: 12 },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  filterLabel: { fontSize: 14, opacity: 0.6 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(127,127,127,0.3)',
    maxWidth: '70%',
  },
  filterChipPressed: { opacity: 0.5 },
  filterChipText: { fontSize: 14, flexShrink: 1 },
  filterChipChevron: { fontSize: 12, opacity: 0.6 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  agendaContainer: { flex: 1, paddingHorizontal: 20 },
});
