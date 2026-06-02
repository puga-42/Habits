import { Platform } from 'react-native';

import {
  fetchHabits,
  fetchTodayCompletions,
  fetchTodayOverrides,
  isoDate,
  weekStart,
  type Completion,
  type Habit,
  type HabitOverride,
} from './habits';
import { expandHabit } from './history';
import { writeWidgetData, reloadWidget } from './widget-sync-bridge';

export type WidgetHabitEntry = {
  id: string;
  title: string;
  icon: string | null;
  color: string | null;
  kind: 'scheduled' | 'flex';
  isCompleted: boolean;
  targetCount: number | null;
  completedCount: number | null;
};

export type WidgetPayload = {
  updatedAt: string;
  habits: WidgetHabitEntry[];
};

export function buildWidgetPayload(
  habits: Habit[],
  completions: Completion[],
  overrides: HabitOverride[],
  today: Date,
): WidgetPayload {
  const entries: WidgetHabitEntry[] = [];
  const todayIso = isoDate(today);

  const skippedKeys = new Set(
    overrides
      .filter((o) => o.kind === 'skip')
      .map((o) => `${o.habit_id}:${o.occurrence_date}`),
  );

  const dayStart = new Date(today);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(today);
  dayEnd.setHours(23, 59, 59, 999);

  for (const habit of habits) {
    if (habit.kind !== 'scheduled') continue;
    const dates = expandHabit(habit, dayStart, dayEnd);
    for (const d of dates) {
      const occDate = isoDate(d);
      if (skippedKeys.has(`${habit.id}:${occDate}`)) continue;
      const isCompleted = completions.some(
        (c) => c.habit_id === habit.id && c.occurrence_date === occDate,
      );
      entries.push({
        id: habit.id,
        title: habit.title,
        icon: habit.icon,
        color: habit.color,
        kind: 'scheduled',
        isCompleted,
        targetCount: null,
        completedCount: null,
      });
    }
  }

  const periodStart = isoDate(weekStart(today));
  for (const h of habits) {
    if (h.kind !== 'flex') continue;
    if (h.target_count == null || h.target_period == null) continue;
    const count = completions.filter(
      (c) => c.habit_id === h.id && c.period_start === periodStart,
    ).length;
    entries.push({
      id: h.id,
      title: h.title,
      icon: h.icon,
      color: h.color,
      kind: 'flex',
      isCompleted: count >= h.target_count,
      targetCount: h.target_count,
      completedCount: count,
    });
  }

  return { updatedAt: new Date().toISOString(), habits: entries };
}

async function performSync(userId: string): Promise<void> {
  if (Platform.OS !== 'ios') return;
  try {
    const [habits, completions, overrides] = await Promise.all([
      fetchHabits(userId),
      fetchTodayCompletions(userId),
      fetchTodayOverrides(),
    ]);
    const payload = buildWidgetPayload(habits, completions, overrides, new Date());
    writeWidgetData(payload);
    reloadWidget();
  } catch (err) {
    console.warn('Widget sync failed:', err);
  }
}

let syncTimer: ReturnType<typeof setTimeout> | null = null;
const SYNC_DEBOUNCE_MS = 500;

export function syncWidgetData(userId: string): void {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    performSync(userId);
  }, SYNC_DEBOUNCE_MS);
}
