import { relativeDayName } from '../relative-day';

describe('relativeDayName', () => {
  const TODAY = '2026-07-08';

  it('names today, yesterday, and tomorrow', () => {
    expect(relativeDayName('2026-07-08', TODAY)).toBe('Today');
    expect(relativeDayName('2026-07-07', TODAY)).toBe('Yesterday');
    expect(relativeDayName('2026-07-09', TODAY)).toBe('Tomorrow');
  });

  it('returns null for any other day (caller falls back to the date)', () => {
    expect(relativeDayName('2026-07-06', TODAY)).toBeNull();
    expect(relativeDayName('2026-07-10', TODAY)).toBeNull();
    expect(relativeDayName('2025-07-08', TODAY)).toBeNull();
  });

  it('crosses month and year boundaries correctly', () => {
    expect(relativeDayName('2026-06-30', '2026-07-01')).toBe('Yesterday');
    expect(relativeDayName('2026-08-01', '2026-07-31')).toBe('Tomorrow');
    expect(relativeDayName('2025-12-31', '2026-01-01')).toBe('Yesterday');
    expect(relativeDayName('2024-02-29', '2024-02-28')).toBe('Tomorrow');
  });
});
