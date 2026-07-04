import { blockingCompletionDate } from '../start-date';

// Original start: Jun 1. Dates are YYYY-MM-DD occurrence_dates.
const ORIGINAL = new Date(2026, 5, 1).toISOString();

describe('blockingCompletionDate', () => {
  it('allows an unchanged start date', () => {
    expect(
      blockingCompletionDate(ORIGINAL, '2026-06-01', ['2026-06-03']),
    ).toBeNull();
  });

  it('allows moving the start date into the past', () => {
    expect(
      blockingCompletionDate(ORIGINAL, '2026-05-01', ['2026-06-03']),
    ).toBeNull();
  });

  it('blocks a forward move past a completion, returning the earliest', () => {
    expect(
      blockingCompletionDate(ORIGINAL, '2026-06-10', [
        '2026-06-08',
        '2026-06-03',
        '2026-06-12',
      ]),
    ).toBe('2026-06-03');
  });

  it('allows a forward move when all completions are on or after it', () => {
    expect(
      blockingCompletionDate(ORIGINAL, '2026-06-10', ['2026-06-10', '2026-06-15']),
    ).toBeNull();
  });

  it('allows a forward move when there are no completions', () => {
    expect(blockingCompletionDate(ORIGINAL, '2026-06-10', [])).toBeNull();
  });

  it('passes habits without a start date (flex)', () => {
    expect(
      blockingCompletionDate(null, '2026-06-10', ['2026-06-03']),
    ).toBeNull();
  });

  it('ignores null occurrence dates in the history', () => {
    expect(
      blockingCompletionDate(ORIGINAL, '2026-06-10', [null, '2026-06-15']),
    ).toBeNull();
  });
});
