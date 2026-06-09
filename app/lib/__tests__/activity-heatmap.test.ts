import {
  computeMaxCount,
  intensityLevel,
  buildHeatmapGrid,
  heatmapColor,
  formatDaySummary,
  type DayActivity,
} from '../activity-heatmap';

describe('computeMaxCount', () => {
  it('returns 1 for empty array', () => {
    expect(computeMaxCount([])).toBe(1);
  });

  it('returns the max count when under 10', () => {
    const days: DayActivity[] = [
      { date: '2026-06-01', count: 3 },
      { date: '2026-06-02', count: 7 },
      { date: '2026-06-03', count: 2 },
    ];
    expect(computeMaxCount(days)).toBe(7);
  });

  it('caps at 10 when max exceeds 10', () => {
    const days: DayActivity[] = [
      { date: '2026-06-01', count: 15 },
      { date: '2026-06-02', count: 3 },
    ];
    expect(computeMaxCount(days)).toBe(10);
  });

  it('returns 1 when all counts are 0', () => {
    const days: DayActivity[] = [{ date: '2026-06-01', count: 0 }];
    expect(computeMaxCount(days)).toBe(1);
  });
});

describe('intensityLevel', () => {
  it('returns 0 for count 0', () => {
    expect(intensityLevel(0, 8)).toBe(0);
  });

  it('returns 1 for count ≤ 25% of max', () => {
    expect(intensityLevel(1, 8)).toBe(1);
    expect(intensityLevel(2, 8)).toBe(1);
  });

  it('returns 2 for count ≤ 50% of max', () => {
    expect(intensityLevel(3, 8)).toBe(2);
    expect(intensityLevel(4, 8)).toBe(2);
  });

  it('returns 3 for count ≤ 75% of max', () => {
    expect(intensityLevel(5, 8)).toBe(3);
    expect(intensityLevel(6, 8)).toBe(3);
  });

  it('returns 4 for count > 75% of max', () => {
    expect(intensityLevel(7, 8)).toBe(4);
    expect(intensityLevel(8, 8)).toBe(4);
  });

  it('returns 4 for count of 1 when max is 1', () => {
    expect(intensityLevel(1, 1)).toBe(4);
  });
});

describe('buildHeatmapGrid', () => {
  const from = '2025-06-02';
  const to = '2025-06-15';

  it('creates correct number of weeks', () => {
    const grid = buildHeatmapGrid(from, to, []);
    expect(grid.weeks.length).toBe(2);
  });

  it('each week has 7 days', () => {
    const grid = buildHeatmapGrid(from, to, []);
    for (const week of grid.weeks) {
      expect(week.length).toBe(7);
    }
  });

  it('first day is Monday, last day is Sunday', () => {
    const grid = buildHeatmapGrid(from, to, []);
    expect(grid.weeks[0][0].date).toBe('2025-06-02');
    expect(grid.weeks[1][6].date).toBe('2025-06-15');
  });

  it('maps activity counts to correct days', () => {
    const days: DayActivity[] = [
      { date: '2025-06-03', count: 5 },
      { date: '2025-06-10', count: 2 },
    ];
    const grid = buildHeatmapGrid(from, to, days);
    expect(grid.weeks[0][1].count).toBe(5);
    expect(grid.weeks[1][1].count).toBe(2);
  });

  it('assigns intensity levels based on counts', () => {
    const days: DayActivity[] = [
      { date: '2025-06-02', count: 1 },
      { date: '2025-06-03', count: 4 },
      { date: '2025-06-04', count: 8 },
    ];
    const grid = buildHeatmapGrid(from, to, days);
    expect(grid.weeks[0][0].level).toBe(1);
    expect(grid.weeks[0][1].level).toBe(2);
    expect(grid.weeks[0][2].level).toBe(4);
  });

  it('days with no activity have level 0 and count 0', () => {
    const grid = buildHeatmapGrid(from, to, []);
    expect(grid.weeks[0][0].count).toBe(0);
    expect(grid.weeks[0][0].level).toBe(0);
  });

  it('aligns to Monday when from is mid-week', () => {
    const grid = buildHeatmapGrid('2025-06-04', '2025-06-15', []);
    expect(grid.weeks[0][0].date).toBe('2025-06-02');
  });

  it('aligns to Sunday when to is mid-week', () => {
    const grid = buildHeatmapGrid('2025-06-02', '2025-06-12', []);
    expect(grid.weeks[1][6].date).toBe('2025-06-15');
  });

  it('generates month labels when month boundary is crossed', () => {
    const grid = buildHeatmapGrid('2025-05-26', '2025-06-08', []);
    const juneLabel = grid.monthLabels.find((l) => l.label === 'Jun');
    expect(juneLabel).toBeDefined();
    expect(juneLabel!.weekIndex).toBe(1);
  });

  it('includes first month in labels', () => {
    const grid = buildHeatmapGrid('2025-05-26', '2025-06-08', []);
    const mayLabel = grid.monthLabels.find((l) => l.label === 'May');
    expect(mayLabel).toBeDefined();
    expect(mayLabel!.weekIndex).toBe(0);
  });

  it('handles single-week range', () => {
    const grid = buildHeatmapGrid('2025-06-02', '2025-06-08', []);
    expect(grid.weeks.length).toBe(1);
    expect(grid.weeks[0].length).toBe(7);
  });
});

describe('heatmapColor', () => {
  it('returns empty cell color for level 0', () => {
    const color = heatmapColor('#09EDE2', 0, true);
    expect(color).not.toBe('#09EDE2');
  });

  it('returns increasingly distinct colors for higher levels', () => {
    const c1 = heatmapColor('#09EDE2', 1, true);
    const c2 = heatmapColor('#09EDE2', 2, true);
    const c3 = heatmapColor('#09EDE2', 3, true);
    const c4 = heatmapColor('#09EDE2', 4, true);
    expect(new Set([c1, c2, c3, c4]).size).toBe(4);
  });

  it('produces different colors for different base colors', () => {
    const tiffany = heatmapColor('#09EDE2', 3, true);
    const purple = heatmapColor('#A78BFA', 3, true);
    expect(tiffany).not.toBe(purple);
  });

  it('produces different colors for light vs dark mode', () => {
    const dark = heatmapColor('#09EDE2', 2, true);
    const light = heatmapColor('#09EDE2', 2, false);
    expect(dark).not.toBe(light);
  });
});

describe('formatDaySummary', () => {
  it('formats plural count with full day name', () => {
    expect(formatDaySummary('2026-06-03', 3)).toBe('3 habits completed on Wednesday, June 3');
  });

  it('formats singular count', () => {
    expect(formatDaySummary('2026-06-01', 1)).toBe('1 habit completed on Monday, June 1');
  });

  it('formats zero count', () => {
    expect(formatDaySummary('2026-05-31', 0)).toBe('0 habits completed on Sunday, May 31');
  });
});
