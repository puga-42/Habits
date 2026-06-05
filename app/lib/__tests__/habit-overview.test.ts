import { currentPeriodStart, resolveEffectiveNote } from '../habit-overview';

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

describe('resolveEffectiveNote', () => {
  const makeCompletion = (id: string, note: string | null) => ({
    id,
    note,
    habit_id: 'h1',
    owner_id: 'u1',
    occurrence_date: null,
    period_start: '2026-06-01',
    completed_at: '2026-06-01T10:00:00Z',
    visibility_override: null,
    attachments: [],
  });

  it('returns pending note when present', () => {
    const pending = new Map<string, string | null>([['c1', 'updated']]);
    expect(resolveEffectiveNote(pending, makeCompletion('c1', 'original'))).toBe('updated');
  });

  it('returns null when pending note is explicitly null', () => {
    const pending = new Map<string, string | null>([['c1', null]]);
    expect(resolveEffectiveNote(pending, makeCompletion('c1', 'original'))).toBeNull();
  });

  it('falls back to completion note when no pending entry', () => {
    const pending = new Map<string, string | null>();
    expect(resolveEffectiveNote(pending, makeCompletion('c1', 'stored'))).toBe('stored');
  });

  it('returns null when no pending and completion note is null', () => {
    const pending = new Map<string, string | null>();
    expect(resolveEffectiveNote(pending, makeCompletion('c1', null))).toBeNull();
  });
});
