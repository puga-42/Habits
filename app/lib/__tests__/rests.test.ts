import { dayBeforeIso, restWakeOutcome } from '../rests';

describe('dayBeforeIso', () => {
  it('returns the previous calendar day', () => {
    expect(dayBeforeIso('2026-06-17')).toBe('2026-06-16');
  });

  it('rolls back across a month boundary', () => {
    expect(dayBeforeIso('2026-03-01')).toBe('2026-02-28');
  });

  it('rolls back across a year boundary', () => {
    expect(dayBeforeIso('2026-01-01')).toBe('2025-12-31');
  });

  it('handles a leap day', () => {
    expect(dayBeforeIso('2024-03-01')).toBe('2024-02-29');
  });
});

describe('restWakeOutcome', () => {
  const rest = { start_date: '2026-06-10', end_date: '2026-06-20' };

  it('cancels the rest when waking before it starts', () => {
    expect(restWakeOutcome(rest, '2026-06-09')).toEqual({ kind: 'cancel' });
  });

  it('cancels the rest when waking on the start day (it never effectively happened)', () => {
    expect(restWakeOutcome(rest, '2026-06-10')).toEqual({ kind: 'cancel' });
  });

  it('trims the end to the day before when waking mid-period', () => {
    expect(restWakeOutcome(rest, '2026-06-15')).toEqual({
      kind: 'trim',
      endDate: '2026-06-14',
    });
  });

  it('trims when waking on the final day so the rest keeps prior days neutral', () => {
    expect(restWakeOutcome(rest, '2026-06-20')).toEqual({
      kind: 'trim',
      endDate: '2026-06-19',
    });
  });

  it('is a no-op when waking after the rest has already ended', () => {
    expect(restWakeOutcome(rest, '2026-06-21')).toEqual({ kind: 'noop' });
  });
});
