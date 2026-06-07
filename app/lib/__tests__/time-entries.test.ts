import { sumDurationSeconds, progressFraction, type TimeEntry } from '../time-entries';

function entry(overrides: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: 'e1',
    habit_id: 'h1',
    owner_id: 'u1',
    occurrence_date: '2026-06-07',
    period_start: null,
    started_at: '2026-06-07T08:00:00Z',
    ended_at: '2026-06-07T08:10:00Z',
    duration_seconds: 600,
    created_at: '2026-06-07T08:00:00Z',
    ...overrides,
  };
}

describe('sumDurationSeconds', () => {
  it('sums completed entries', () => {
    const entries = [
      entry({ duration_seconds: 300 }),
      entry({ id: 'e2', duration_seconds: 200 }),
    ];
    expect(sumDurationSeconds(entries)).toBe(500);
  });

  it('returns 0 for empty list', () => {
    expect(sumDurationSeconds([])).toBe(0);
  });

  it('includes running entry using now param', () => {
    const now = new Date('2026-06-07T08:05:00Z');
    const entries = [
      entry({ duration_seconds: 300 }),
      entry({
        id: 'e2',
        started_at: '2026-06-07T08:00:00Z',
        ended_at: null,
        duration_seconds: null,
      }),
    ];
    expect(sumDurationSeconds(entries, now)).toBe(600);
  });

  it('ignores null duration when ended_at is also null and no now provided', () => {
    const entries = [
      entry({
        started_at: '2026-06-07T08:00:00Z',
        ended_at: null,
        duration_seconds: null,
      }),
    ];
    expect(sumDurationSeconds(entries)).toBe(0);
  });
});

describe('progressFraction', () => {
  it('returns 0 for no entries', () => {
    expect(progressFraction([], 1800)).toBe(0);
  });

  it('returns fraction of target', () => {
    const entries = [entry({ duration_seconds: 900 })];
    expect(progressFraction(entries, 1800)).toBe(0.5);
  });

  it('caps at 1.0', () => {
    const entries = [entry({ duration_seconds: 3600 })];
    expect(progressFraction(entries, 1800)).toBe(1);
  });

  it('handles exact target', () => {
    const entries = [entry({ duration_seconds: 1800 })];
    expect(progressFraction(entries, 1800)).toBe(1);
  });
});
