// Alerts — per-habit reminder times ("HH:MM", 24h, device-local), delivered as
// on-device local notifications (CONTEXT.md § Notifications: local for
// reminders, server push for social). This module is the pure planner; the
// side-effectful scheduling lives in alert-scheduler.ts.
//
// A scheduled habit alerts on its occurrence days (RRULE-expanded, respecting
// `until`); a flex habit alerts every day until `until`. The plan covers a
// rolling window (default 7 days) and is capped below iOS's ~64 pending-local
// limit, keeping the earliest alerts.

import { applyTimeToDate, isoDate, type Habit } from './habits';
import { expandHabit } from './history';

export const MAX_PLANNED_ALERTS = 60;

export type PlannedAlert = {
  habitId: string;
  title: string;
  body: string;
  fireDate: Date;
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidAlertTime(s: string): boolean {
  return TIME_RE.test(s);
}

// Boundary normalization before any write: drop invalid, dedupe, sort. Padded
// 24h strings sort chronologically as plain strings.
export function normalizeAlertTimes(times: string[]): string[] {
  return [...new Set(times.filter(isValidAlertTime))].sort();
}

export function formatAlertTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10));
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export function describeAlerts(times: string[]): string {
  if (times.length === 0) return 'None';
  if (times.length === 1) return formatAlertTime(times[0]);
  return `${times.length} alerts`;
}

// The local-midnight days a habit should alert on within [from .. to].
function alertDays(habit: Habit, from: Date, to: Date): Date[] {
  if (habit.kind === 'scheduled') {
    const seen = new Set<string>();
    const days: Date[] = [];
    for (const occ of expandHabit(habit, from, to)) {
      const day = startOfLocalDay(occ);
      const key = isoDate(day);
      if (seen.has(key)) continue;
      seen.add(key);
      days.push(day);
    }
    return days;
  }
  // Flex: every day of the window, bounded by `until` when set.
  const stop = habit.until ? new Date(habit.until).getTime() : null;
  const days: Date[] = [];
  for (let d = startOfLocalDay(from); d <= to; d = addDays(d, 1)) {
    if (stop !== null && d.getTime() > stop) break;
    days.push(d);
  }
  return days;
}

export function planAlerts(
  habits: Habit[],
  now: Date,
  windowDays = 7,
): PlannedAlert[] {
  const from = startOfLocalDay(now);
  const to = endOfLocalDay(addDays(now, windowDays - 1));
  const plan: PlannedAlert[] = [];

  for (const habit of habits) {
    const times = normalizeAlertTimes(habit.alert_times ?? []);
    if (times.length === 0) continue;
    for (const day of alertDays(habit, from, to)) {
      for (const time of times) {
        const fireDate = applyTimeToDate(day, time);
        if (fireDate.getTime() <= now.getTime()) continue;
        plan.push({
          habitId: habit.id,
          title: habit.icon ? `${habit.icon} ${habit.title}` : habit.title,
          body: `Time for ${habit.title}.`,
          fireDate,
        });
      }
    }
  }

  return plan
    .sort((a, b) => a.fireDate.getTime() - b.fireDate.getTime())
    .slice(0, MAX_PLANNED_ALERTS);
}

// ─── Local date helpers ────────────────────────────────────────────────────

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}
