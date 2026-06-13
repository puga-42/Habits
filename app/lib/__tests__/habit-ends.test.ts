import { addMonths, clampEndDate, defaultEndDate } from '../habit-ends';

describe('addMonths', () => {
  it('adds whole months within the same year', () => {
    expect(addMonths(new Date(2026, 0, 15), 1)).toEqual(new Date(2026, 1, 15));
  });

  it('clamps to the last day when the target month is shorter', () => {
    // Jan 31 + 1 month → Feb 28 (2026 is not a leap year), not March 3.
    expect(addMonths(new Date(2026, 0, 31), 1)).toEqual(new Date(2026, 1, 28));
  });

  it('rolls over into the next year', () => {
    expect(addMonths(new Date(2026, 11, 10), 1)).toEqual(new Date(2027, 0, 10));
  });

  it('does not mutate the input date', () => {
    const start = new Date(2026, 0, 15);
    addMonths(start, 3);
    expect(start).toEqual(new Date(2026, 0, 15));
  });
});

describe('defaultEndDate', () => {
  it('defaults to one month after the start', () => {
    expect(defaultEndDate(new Date(2026, 5, 12))).toEqual(new Date(2026, 6, 12));
  });
});

describe('clampEndDate', () => {
  it('returns the end when it is after the start', () => {
    const start = new Date(2026, 0, 1);
    const end = new Date(2026, 2, 1);
    expect(clampEndDate(start, end)).toEqual(end);
  });

  it('snaps to the start when the end is before the start', () => {
    const start = new Date(2026, 2, 1);
    const end = new Date(2026, 0, 1);
    expect(clampEndDate(start, end)).toEqual(start);
  });

  it('returns the start when end equals start', () => {
    const start = new Date(2026, 2, 1);
    expect(clampEndDate(start, new Date(2026, 2, 1))).toEqual(start);
  });
});
