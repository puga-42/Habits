import { currentPeriodStart } from '../habit-overview';

describe('currentPeriodStart', () => {
  it('returns the same date for day period', () => {
    expect(currentPeriodStart('2026-06-03', 'day')).toBe('2026-06-03');
  });

  it('returns Monday for week period (mid-week)', () => {
    // 2026-06-03 is a Wednesday
    expect(currentPeriodStart('2026-06-03', 'week')).toBe('2026-06-01');
  });

  it('returns Monday for week period (on Monday)', () => {
    expect(currentPeriodStart('2026-06-01', 'week')).toBe('2026-06-01');
  });

  it('returns Monday for week period (on Sunday)', () => {
    // 2026-06-07 is a Sunday
    expect(currentPeriodStart('2026-06-07', 'week')).toBe('2026-06-01');
  });

  it('returns first of month for month period', () => {
    expect(currentPeriodStart('2026-06-15', 'month')).toBe('2026-06-01');
  });

  it('returns first of month when already on the 1st', () => {
    expect(currentPeriodStart('2026-06-01', 'month')).toBe('2026-06-01');
  });

  it('handles year boundary for month period', () => {
    expect(currentPeriodStart('2026-01-20', 'month')).toBe('2026-01-01');
  });

  it('handles week spanning year boundary', () => {
    // 2025-12-31 is a Wednesday, week starts 2025-12-29 (Monday)
    expect(currentPeriodStart('2025-12-31', 'week')).toBe('2025-12-29');
  });
});
