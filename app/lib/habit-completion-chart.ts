// Completions-by-period chart — types, all-time query, and pure bucketing.
// Pure helpers are TDD'd; see __tests__/habit-completion-chart.test.ts.

import { fetchActivityHeatmap, type DayActivity } from './activity-heatmap';
import { isoDate, type Habit } from './habits';

// ─── Types ─────────────────────────────────────────────────────────────────

export type ChartView = 'weekly' | 'monthly' | 'weeks_year' | 'month';

export type ChartBar = { key: string; label: string; count: number };

export const CHART_VIEWS: { key: ChartView; label: string }[] = [
  { key: 'weekly', label: 'Weekday' },
  { key: 'monthly', label: 'Day' },
  { key: 'weeks_year', label: 'Week' },
  { key: 'month', label: 'Month' },
];

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// Floor far enough back to capture any real completion history.
const ALL_TIME_FLOOR = '2015-01-01';

// ─── Query ─────────────────────────────────────────────────────────────────

/**
 * All-time per-day completion counts for a habit's lineage, RLS-enforced.
 * Reuses the heatmap RPC over a wide window — no dedicated endpoint needed.
 */
export async function fetchHabitDowActivity(
  habit: Pick<Habit, 'owner_id' | 'lineage_id'>,
  viewerId: string,
): Promise<DayActivity[]> {
  const to = isoDate(new Date());
  return fetchActivityHeatmap(
    habit.owner_id,
    viewerId,
    ALL_TIME_FLOOR,
    to,
    habit.lineage_id,
  );
}

// ─── Pure helpers ──────────────────────────────────────────────────────────

/** Day of week with Monday = 0 … Sunday = 6. */
export function mondayDayOfWeek(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/** ISO 8601 week number (1–53), Monday-based. */
export function isoWeek(d: Date): number {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  // Shift to the Thursday of this ISO week.
  date.setDate(date.getDate() - mondayDayOfWeek(date) + 3);
  const firstThursday = new Date(date.getFullYear(), 0, 4);
  firstThursday.setDate(
    firstThursday.getDate() - mondayDayOfWeek(firstThursday) + 3,
  );
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  return 1 + Math.round((date.getTime() - firstThursday.getTime()) / msPerWeek);
}

type ViewConfig = {
  size: number;
  label: (index: number) => string;
  index: (d: Date) => number;
};

const VIEW_CONFIG: Record<ChartView, ViewConfig> = {
  weekly: {
    size: 7,
    label: (i) => WEEKDAY_LABELS[i],
    index: (d) => mondayDayOfWeek(d),
  },
  monthly: {
    size: 31,
    label: (i) => String(i + 1),
    index: (d) => d.getDate() - 1,
  },
  weeks_year: {
    size: 53,
    label: (i) => String(i + 1),
    index: (d) => isoWeek(d) - 1,
  },
  month: {
    size: 12,
    label: (i) => MONTH_LABELS[i],
    index: (d) => d.getMonth(),
  },
};

function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Bucket all-time daily counts onto the x-axis for the given view. */
export function bucketByView(days: DayActivity[], view: ChartView): ChartBar[] {
  const cfg = VIEW_CONFIG[view];
  const bars: ChartBar[] = Array.from({ length: cfg.size }, (_, i) => ({
    key: `${view}-${i}`,
    label: cfg.label(i),
    count: 0,
  }));

  for (const day of days) {
    if (day.count <= 0) continue;
    const i = cfg.index(parseDate(day.date));
    if (i >= 0 && i < cfg.size) bars[i].count += day.count;
  }

  return bars;
}

/** Largest bucket count, floored at 1 so the y-axis never divides by zero. */
export function maxBarCount(bars: ChartBar[]): number {
  return Math.max(1, ...bars.map((b) => b.count));
}

/** Round up to the nearest 1/2/5 × 10ⁿ — a "nice" axis step. */
function niceCeil(n: number): number {
  if (n <= 1) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(n)));
  for (const m of [1, 2, 5, 10]) {
    if (m * pow >= n) return m * pow;
  }
  return 10 * pow;
}

/**
 * Y-axis tick values from 0 up to a rounded max, given the largest bar count.
 * Integers only (completions are whole). The last tick is the axis maximum
 * the bars should scale against.
 */
export function yAxisTicks(maxCount: number): number[] {
  const max = Math.max(1, Math.ceil(maxCount));
  if (max <= 5) {
    return Array.from({ length: max + 1 }, (_, i) => i);
  }
  const step = niceCeil(Math.ceil(max / 4));
  const ticks: number[] = [];
  for (let v = 0; v <= max; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}
