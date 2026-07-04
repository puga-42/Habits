import { dateInTimeZone, expandOccurrenceDates } from '../rrule-window';

// These tests pin each habit's timezone explicitly, so they assert the same
// result no matter what timezone the test runner itself is in. That is the
// whole point of the fix: expansion must not depend on the device zone.

describe('dateInTimeZone', () => {
  it('reads an instant as its calendar date in the given zone', () => {
    // 15:00Z is the next calendar day in Tokyo (UTC+9).
    expect(dateInTimeZone('2026-07-05T15:00:00Z', 'Asia/Tokyo')).toBe('2026-07-06');
    // Same instant is still the 5th in Los Angeles (UTC-7).
    expect(dateInTimeZone('2026-07-05T15:00:00Z', 'America/Los_Angeles')).toBe('2026-07-05');
  });
});

describe('expandOccurrenceDates', () => {
  const MO = 'FREQ=WEEKLY;BYDAY=MO';

  it('lands weekly habits on the intended local day for UTC+ users (old-format dtstart)', () => {
    // Buggy writer stored local Tokyo midnight of Mon Jul 6 as an instant.
    const dates = expandOccurrenceDates(
      '2026-07-05T15:00:00Z', MO, null, 'Asia/Tokyo', '2026-07-06', '2026-07-20',
    );
    expect(dates).toEqual(['2026-07-06', '2026-07-13', '2026-07-20']);
  });

  it('gives the same result for fake-UTC (new-format) dtstart', () => {
    const dates = expandOccurrenceDates(
      '2026-07-06T00:00:00Z', MO, null, 'Asia/Tokyo', '2026-07-06', '2026-07-20',
    );
    expect(dates).toEqual(['2026-07-06', '2026-07-13', '2026-07-20']);
  });

  it('still works for UTC- users', () => {
    const dates = expandOccurrenceDates(
      '2026-07-06T07:00:00Z', MO, null, 'America/Los_Angeles', '2026-07-06', '2026-07-20',
    );
    expect(dates).toEqual(['2026-07-06', '2026-07-13', '2026-07-20']);
  });

  it('lands monthly BYMONTHDAY habits on the intended day (UTC+)', () => {
    const dates = expandOccurrenceDates(
      '2026-07-05T15:00:00Z', 'FREQ=MONTHLY;BYMONTHDAY=6', null, 'Asia/Tokyo',
      '2026-07-01', '2026-09-30',
    );
    expect(dates).toEqual(['2026-07-06', '2026-08-06', '2026-09-06']);
  });

  it('does not leak a daily habit onto the day before it starts (UTC+)', () => {
    const dates = expandOccurrenceDates(
      '2026-07-05T15:00:00Z', 'FREQ=DAILY', null, 'Asia/Tokyo', '2026-07-05', '2026-07-08',
    );
    expect(dates).toEqual(['2026-07-06', '2026-07-07', '2026-07-08']);
  });

  it('treats until as inclusive of its whole nominal day (UTC+)', () => {
    const dates = expandOccurrenceDates(
      '2026-07-05T15:00:00Z', MO, '2026-07-12T15:00:00Z', 'Asia/Tokyo',
      '2026-07-06', '2026-07-27',
    );
    expect(dates).toEqual(['2026-07-06', '2026-07-13']);
  });

  it('falls back to the runtime zone when timezone is missing', () => {
    // No throw, returns a plausible window; exact dates depend on runtime zone.
    const dates = expandOccurrenceDates(
      '2026-07-06T00:00:00Z', 'FREQ=DAILY', null, null, '2026-07-06', '2026-07-07',
    );
    expect(dates.length).toBeGreaterThan(0);
  });
});
