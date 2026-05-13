import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/lib/auth';
import {
  applyTimeToDate,
  fetchHabits,
  fetchTodayCompletions,
  fetchTodayOverrides,
  isoDate,
  markFlexCompleted,
  markScheduledCompleted,
  todaysScheduledOccurrences,
  unmarkCompleted,
  weekStart,
  type Completion,
  type Habit,
  type HabitOverride,
  type ScheduledOccurrence,
} from '@/lib/habits';

export default function TodayScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [overrides, setOverrides] = useState<HabitOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    const [h, c, o] = await Promise.all([
      fetchHabits(userId),
      fetchTodayCompletions(userId),
      fetchTodayOverrides(),
    ]);
    setHabits(h);
    setCompletions(c);
    setOverrides(o);
  }, [userId]);

  // Refetch every time Today gains focus (including after the editor modal
  // dismisses), so newly created or edited habits appear immediately.
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

  async function toggleScheduled(habit: Habit, occurrenceDate: string) {
    if (!userId) return;
    const existing = completions.find(
      (c) => c.habit_id === habit.id && c.occurrence_date === occurrenceDate,
    );
    if (existing) await unmarkCompleted(existing.id);
    else await markScheduledCompleted(habit.id, userId, occurrenceDate);
    await load();
  }

  async function addFlexCompletion(habit: Habit) {
    if (!userId) return;
    await markFlexCompleted(habit.id, userId);
    await load();
  }

  function onAddHabit() {
    router.push('/habit/new');
  }

  function onEditScheduled(habit: Habit, occurrenceDate: string) {
    router.push(`/habit/${habit.id}?occurrenceDate=${occurrenceDate}`);
  }

  function onEditFlex(habit: Habit) {
    router.push(`/habit/${habit.id}`);
  }

  if (loading) {
    return (
      <ThemedView style={styles.root}>
        <SafeAreaView edges={['top']} style={[styles.content, styles.centered]}>
          <ActivityIndicator />
        </SafeAreaView>
      </ThemedView>
    );
  }

  // Layer overrides onto the RRULE-expanded occurrences: drop skips, apply
  // edit/reschedule patches.
  const occurrences = todaysScheduledOccurrences(habits).reduce<ScheduledOccurrence[]>(
    (acc, occ) => {
      const override = overrides.find(
        (o) => o.habit_id === occ.habit.id && o.occurrence_date === occ.occurrenceDate,
      );
      if (override?.kind === 'skip') return acc;
      if (override && (override.kind === 'edit' || override.kind === 'reschedule')) {
        const patch = override.patch ?? {};
        acc.push({
          habit: {
            ...occ.habit,
            title: patch.title ?? occ.habit.title,
            icon: patch.icon ?? occ.habit.icon,
            color: patch.color ?? occ.habit.color,
          },
          occurrenceDate: occ.occurrenceDate,
          occurrenceTime: patch.time
            ? applyTimeToDate(occ.occurrenceTime, patch.time)
            : occ.occurrenceTime,
        });
        return acc;
      }
      acc.push(occ);
      return acc;
    },
    [],
  );

  const flexHabits = habits.filter((h) => h.kind === 'flex');
  const wk = isoDate(weekStart(new Date()));
  const isEmpty = occurrences.length === 0 && flexHabits.length === 0;
  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.content}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }>
          <ThemedText type="title">Today</ThemedText>
          <ThemedText type="subtitle">{today}</ThemedText>

          {isEmpty && (
            <View style={styles.emptyState}>
              <ThemedText style={styles.placeholder}>
                No habits yet. Add one to get started.
              </ThemedText>
              <Pressable onPress={onAddHabit} style={styles.primaryButton}>
                <ThemedText type="defaultSemiBold" style={styles.primaryButtonText}>
                  + Add habit
                </ThemedText>
              </Pressable>
            </View>
          )}

          {occurrences.length > 0 && (
            <View style={styles.section}>
              <ThemedText type="subtitle">Scheduled</ThemedText>
              {occurrences.map((occ) => {
                const completion = completions.find(
                  (c) =>
                    c.habit_id === occ.habit.id &&
                    c.occurrence_date === occ.occurrenceDate,
                );
                const done = !!completion;
                return (
                  <Pressable
                    key={`${occ.habit.id}_${occ.occurrenceDate}`}
                    onPress={() => toggleScheduled(occ.habit, occ.occurrenceDate)}
                    onLongPress={() => onEditScheduled(occ.habit, occ.occurrenceDate)}
                    style={styles.row}>
                    <ThemedText style={styles.circle}>{done ? '●' : '○'}</ThemedText>
                    <ThemedText style={[styles.rowTitle, done && styles.rowDone]}>
                      {occ.habit.icon ?? ''} {occ.habit.title}
                    </ThemedText>
                    <ThemedText style={styles.rowMeta}>
                      {occ.occurrenceTime.toLocaleTimeString(undefined, {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          )}

          {flexHabits.length > 0 && (
            <View style={styles.section}>
              <ThemedText type="subtitle">Flex this week</ThemedText>
              {flexHabits.map((h) => {
                const done = completions.filter(
                  (c) => c.habit_id === h.id && c.period_start === wk,
                ).length;
                const target = h.target_count ?? 0;
                return (
                  <Pressable
                    key={h.id}
                    onPress={() => addFlexCompletion(h)}
                    onLongPress={() => onEditFlex(h)}
                    style={styles.row}>
                    <ThemedText style={styles.rowTitle}>
                      {h.icon ?? ''} {h.title}
                    </ThemedText>
                    <ThemedText style={styles.rowMeta}>
                      {done} of {target}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          )}

          {!isEmpty && (
            <Pressable onPress={onAddHabit} style={styles.secondaryButton}>
              <ThemedText type="defaultSemiBold" style={styles.secondaryButtonText}>
                + Add habit
              </ThemedText>
            </Pressable>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 16,
    paddingBottom: 32,
  },
  centered: { alignItems: 'center', justifyContent: 'center' },
  emptyState: { gap: 12, marginTop: 32 },
  placeholder: { opacity: 0.6 },
  primaryButton: {
    borderWidth: 1,
    borderColor: 'rgba(127,127,127,0.4)',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  primaryButtonText: { fontSize: 15 },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 12,
  },
  secondaryButtonText: { fontSize: 15, opacity: 0.7 },
  section: { gap: 4, marginTop: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(127,127,127,0.25)',
  },
  circle: { fontSize: 22, width: 28, textAlign: 'center' },
  rowTitle: { flex: 1, fontSize: 16 },
  rowDone: { opacity: 0.45, textDecorationLine: 'line-through' },
  rowMeta: { opacity: 0.6, fontSize: 14 },
});
