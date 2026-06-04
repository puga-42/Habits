// Activity heatmap — types, RPC-backed query, pure helpers.
// Pure helpers are TDD'd; see __tests__/activity-heatmap.test.ts.

import { solidTint } from '@/constants/colors';
import { supabase } from './supabase';

// ─── Types ─────────────────────────────────────────────────────────────────

export type DayActivity = { date: string; count: number };

export type HeatmapDay = {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
};

export type MonthLabel = { label: string; weekIndex: number };

export type HeatmapGrid = {
  weeks: HeatmapDay[][];
  monthLabels: MonthLabel[];
};

// ─── Query ─────────────────────────────────────────────────────────────────

export async function fetchActivityHeatmap(
  targetId: string,
  viewerId: string,
  from: string,
  to: string,
  habitLineageId?: string,
): Promise<DayActivity[]> {
  const { data, error } = await supabase.rpc('get_user_activity_heatmap', {
    p_target_id: targetId,
    p_viewer_id: viewerId,
    p_from_date: from,
    p_to_date: to,
    p_habit_lineage_id: habitLineageId ?? null,
  });
  if (error) throw error;
  return ((data ?? []) as Array<{ activity_date: string; completion_count: number }>).map(
    (r) => ({ date: r.activity_date, count: r.completion_count }),
  );
}

// ─── Pure helpers ──────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const EMPTY_COLOR_DARK = '#363647';
const EMPTY_COLOR_LIGHT = '#E2E8F0';
const TINT_AMOUNTS: Record<number, number> = { 1: 0.35, 2: 0.55, 3: 0.75, 4: 0.95 };

export function computeMaxCount(days: DayActivity[]): number {
  if (days.length === 0) return 1;
  const max = Math.max(...days.map((d) => d.count));
  if (max <= 0) return 1;
  return Math.min(10, max);
}

export function intensityLevel(count: number, maxCount: number): 0 | 1 | 2 | 3 | 4 {
  if (count === 0) return 0;
  const ratio = count / maxCount;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

export function buildHeatmapGrid(
  from: string,
  to: string,
  days: DayActivity[],
): HeatmapGrid {
  const start = alignToMonday(from);
  const end = alignToSunday(to);

  const countMap = new Map<string, number>();
  for (const d of days) countMap.set(d.date, d.count);

  const maxCount = computeMaxCount(days);
  const weeks: HeatmapDay[][] = [];
  const monthLabels: MonthLabel[] = [];
  let prevMonth = -1;

  const cursor = new Date(start);
  while (cursor <= end) {
    const week: HeatmapDay[] = [];
    for (let dow = 0; dow < 7; dow++) {
      const dateStr = formatDate(cursor);
      const count = countMap.get(dateStr) ?? 0;
      week.push({ date: dateStr, count, level: intensityLevel(count, maxCount) });

      if (dow === 0) {
        const month = cursor.getMonth();
        if (month !== prevMonth) {
          monthLabels.push({ label: MONTH_NAMES[month], weekIndex: weeks.length });
          prevMonth = month;
        }
      }

      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }

  return { weeks, monthLabels };
}

export function heatmapColor(
  baseColor: string,
  level: 0 | 1 | 2 | 3 | 4,
  isDark = true,
): string {
  if (level === 0) return isDark ? EMPTY_COLOR_DARK : EMPTY_COLOR_LIGHT;
  return solidTint(baseColor, TINT_AMOUNTS[level], isDark);
}

// ─── Internal ──────────────────────────────────────────────────────────────

function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function alignToMonday(dateStr: string): Date {
  const d = parseDate(dateStr);
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  return d;
}

function alignToSunday(dateStr: string): Date {
  const d = parseDate(dateStr);
  const dow = d.getDay();
  if (dow !== 0) d.setDate(d.getDate() + (7 - dow));
  return d;
}
