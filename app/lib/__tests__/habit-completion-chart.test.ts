import {
  bucketByView,
  isoWeek,
  mondayDayOfWeek,
  yAxisTicks,
  CHART_VIEWS,
  type ChartView,
} from '../habit-completion-chart';
import type { DayActivity } from '../activity-heatmap';

describe('mondayDayOfWeek', () => {
  it('maps Monday to 0 and Sunday to 6', () => {
    expect(mondayDayOfWeek(new Date(2026, 5, 8))).toBe(0); // Mon 2026-06-08
    expect(mondayDayOfWeek(new Date(2026, 5, 14))).toBe(6); // Sun 2026-06-14
  });
});

describe('isoWeek', () => {
  it('returns week 1 for early January in the first ISO week', () => {
    expect(isoWeek(new Date(2026, 0, 5))).toBe(2); // Mon 2026-01-05
    expect(isoWeek(new Date(2026, 0, 1))).toBe(1); // Thu 2026-01-01
  });

  it('handles the 53-week year (2020 has ISO week 53)', () => {
    expect(isoWeek(new Date(2020, 11, 31))).toBe(53); // Thu 2020-12-31
  });

  it('rolls Jan 1 into the prior year final week', () => {
    expect(isoWeek(new Date(2022, 0, 1))).toBe(52); // Sat 2022-01-01 → 2021-W52
  });
});

describe('CHART_VIEWS', () => {
  it('exposes the four views in order', () => {
    expect(CHART_VIEWS.map((v) => v.key)).toEqual([
      'weekly',
      'monthly',
      'weeks_year',
      'month',
    ]);
  });
});

describe('yAxisTicks', () => {
  it('lists every integer for small maxes', () => {
    expect(yAxisTicks(1)).toEqual([0, 1]);
    expect(yAxisTicks(3)).toEqual([0, 1, 2, 3]);
    expect(yAxisTicks(5)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('floors at 1 for zero/empty data', () => {
    expect(yAxisTicks(0)).toEqual([0, 1]);
  });

  it('uses a nice step and a top tick >= max for larger maxes', () => {
    expect(yAxisTicks(7)).toEqual([0, 2, 4, 6, 8]);
    expect(yAxisTicks(100)).toEqual([0, 50, 100]);
    const ticks = yAxisTicks(12);
    expect(ticks[0]).toBe(0);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(12);
  });
});

describe('bucketByView', () => {
  const days: DayActivity[] = [
    { date: '2026-06-08', count: 2 }, // Mon, day 8, Jun, ISO W24
    { date: '2026-06-09', count: 1 }, // Tue
    { date: '2025-06-09', count: 3 }, // Mon (2025-06-09), day 9, Jun, prior year
    { date: '2026-01-01', count: 1 }, // Thu, day 1, Jan, ISO W1
  ];

  it('weekly: 7 bars Mon–Sun, summed across years', () => {
    const bars = bucketByView(days, 'weekly');
    expect(bars).toHaveLength(7);
    expect(bars[0].label).toBe('Mon');
    expect(bars[6].label).toBe('Sun');
    // Mondays: 2026-06-08 (2) + 2025-06-09 (3) = 5
    expect(bars[0].count).toBe(5);
    // Tuesday: 2026-06-09 (1); Thursday: 2026-01-01 (1)
    expect(bars[1].count).toBe(1);
    expect(bars[3].count).toBe(1);
  });

  it('monthly: 31 bars by day-of-month', () => {
    const bars = bucketByView(days, 'monthly');
    expect(bars).toHaveLength(31);
    expect(bars[0].label).toBe('1');
    expect(bars[0].count).toBe(1); // the 1st
    expect(bars[7].count).toBe(2); // the 8th: 2026-06-08
    expect(bars[8].count).toBe(4); // the 9th: 2025-06-09 (3) + 2026-06-09 (1)
  });

  it('weeks_year: 53 bars by ISO week', () => {
    const bars = bucketByView(days, 'weeks_year');
    expect(bars).toHaveLength(53);
    expect(bars[0].label).toBe('1');
    expect(bars[0].count).toBe(1); // 2026-01-01 → W1
    // 2026-06-08 (2), 2026-06-09 (1) and 2025-06-09 (3) all fall in ISO week 24
    expect(bars[23].count).toBe(6);
  });

  it('month: 12 bars Jan–Dec', () => {
    const bars = bucketByView(days, 'month');
    expect(bars).toHaveLength(12);
    expect(bars[0].label).toBe('Jan');
    expect(bars[0].count).toBe(1); // Jan
    expect(bars[5].label).toBe('Jun');
    expect(bars[5].count).toBe(6); // 2+1+3 all in June
  });

  it('returns all-zero buckets for no data', () => {
    const views: ChartView[] = ['weekly', 'monthly', 'weeks_year', 'month'];
    for (const v of views) {
      const bars = bucketByView([], v);
      expect(bars.every((b) => b.count === 0)).toBe(true);
    }
  });
});
