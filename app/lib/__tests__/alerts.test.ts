import {
  MAX_PLANNED_ALERTS,
  describeAlerts,
  formatAlertTime,
  isValidAlertTime,
  normalizeAlertTimes,
  planAlerts,
} from '../alerts';
import type { Habit } from '../habits';

// Minimal habit factory — only the fields the planner reads matter.
function habit(patch: Partial<Habit>): Habit {
  return {
    id: 'h1',
    lineage_id: 'h1',
    owner_id: 'u1',
    kind: 'scheduled',
    title: 'Meditate',
    description: null,
    color: null,
    icon: null,
    visibility: 'private',
    timezone: 'America/Los_Angeles',
    dtstart: new Date(2026, 5, 1).toISOString(), // Jun 1, local midnight
    rrule: 'FREQ=DAILY',
    until: null,
    target_count: null,
    target_period: null,
    unit: 'count',
    count_unit: null,
    target_seconds: null,
    display_unit: null,
    sort_index: 1,
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    deleted_at: null,
    alert_times: ['08:00'],
    ...patch,
  } as Habit;
}

describe('isValidAlertTime', () => {
  it('accepts padded 24h HH:MM', () => {
    expect(isValidAlertTime('00:00')).toBe(true);
    expect(isValidAlertTime('07:30')).toBe(true);
    expect(isValidAlertTime('23:59')).toBe(true);
  });

  it('rejects out-of-range and malformed values', () => {
    expect(isValidAlertTime('24:00')).toBe(false);
    expect(isValidAlertTime('07:60')).toBe(false);
    expect(isValidAlertTime('7:30')).toBe(false);
    expect(isValidAlertTime('ab:cd')).toBe(false);
    expect(isValidAlertTime('')).toBe(false);
  });
});

describe('normalizeAlertTimes', () => {
  it('drops invalid entries, dedupes, and sorts chronologically', () => {
    expect(normalizeAlertTimes(['21:00', 'oops', '08:00', '21:00'])).toEqual([
      '08:00',
      '21:00',
    ]);
  });

  it('returns [] for empty or all-invalid input', () => {
    expect(normalizeAlertTimes([])).toEqual([]);
    expect(normalizeAlertTimes(['nope'])).toEqual([]);
  });
});

describe('formatAlertTime', () => {
  it('renders 12-hour times', () => {
    expect(formatAlertTime('07:30')).toBe('7:30 AM');
    expect(formatAlertTime('00:00')).toBe('12:00 AM');
    expect(formatAlertTime('12:05')).toBe('12:05 PM');
    expect(formatAlertTime('21:00')).toBe('9:00 PM');
  });
});

describe('describeAlerts', () => {
  it('summarizes for the form row', () => {
    expect(describeAlerts([])).toBe('None');
    expect(describeAlerts(['07:30'])).toBe('7:30 AM');
    expect(describeAlerts(['07:30', '21:00'])).toBe('2 alerts');
  });
});

describe('planAlerts', () => {
  // Wednesday Jul 1 2026, 6:00 AM local.
  const now = new Date(2026, 6, 1, 6, 0, 0);

  it('plans one alert per occurrence day at the alert time over the window', () => {
    const plan = planAlerts([habit({})], now, 7);
    expect(plan).toHaveLength(7);
    expect(plan[0].fireDate).toEqual(new Date(2026, 6, 1, 8, 0, 0));
    expect(plan[6].fireDate).toEqual(new Date(2026, 6, 7, 8, 0, 0));
    expect(plan[0].habitId).toBe('h1');
  });

  it('excludes alert times already past (strictly future only)', () => {
    const later = new Date(2026, 6, 1, 9, 0, 0); // 9 AM, past the 8 AM alert
    const plan = planAlerts([habit({})], later, 7);
    expect(plan).toHaveLength(6);
    expect(plan[0].fireDate).toEqual(new Date(2026, 6, 2, 8, 0, 0));
  });

  it('excludes an alert firing exactly at now', () => {
    const atAlert = new Date(2026, 6, 1, 8, 0, 0);
    const plan = planAlerts([habit({})], atAlert, 7);
    expect(plan[0].fireDate).toEqual(new Date(2026, 6, 2, 8, 0, 0));
  });

  it('respects the scheduled habit until', () => {
    const plan = planAlerts(
      [habit({ until: new Date(2026, 6, 2, 23, 59, 59).toISOString() })],
      now,
      7,
    );
    expect(plan).toHaveLength(2); // Jul 1 + Jul 2 only
  });

  it('only fires on RRULE occurrence days', () => {
    // Jul 6 2026 is the only Monday in the 7-day window starting Wed Jul 1.
    const plan = planAlerts([habit({ rrule: 'FREQ=WEEKLY;BYDAY=MO' })], now, 7);
    expect(plan).toHaveLength(1);
    expect(plan[0].fireDate).toEqual(new Date(2026, 6, 6, 8, 0, 0));
  });

  it('fires flex habits every day of the window', () => {
    const flex = habit({
      kind: 'flex',
      rrule: null,
      dtstart: null,
      target_count: 3,
      target_period: 'week',
    });
    const plan = planAlerts([flex], now, 7);
    expect(plan).toHaveLength(7);
  });

  it('stops flex alerts at until', () => {
    const flex = habit({
      kind: 'flex',
      rrule: null,
      dtstart: null,
      until: new Date(2026, 5, 30).toISOString(), // ended before the window
    });
    expect(planAlerts([flex], now, 7)).toHaveLength(0);
  });

  it('skips habits with no alert times', () => {
    expect(planAlerts([habit({ alert_times: [] })], now, 7)).toHaveLength(0);
    expect(planAlerts([habit({ alert_times: null })], now, 7)).toHaveLength(0);
  });

  it('sorts the combined plan ascending across habits and times', () => {
    const a = habit({ id: 'a', alert_times: ['21:00'] });
    const b = habit({ id: 'b', alert_times: ['08:00'] });
    const plan = planAlerts([a, b], now, 2);
    expect(plan.map((p) => [p.habitId, p.fireDate.getHours()])).toEqual([
      ['b', 8],
      ['a', 21],
      ['b', 8],
      ['a', 21],
    ]);
  });

  it('caps the plan at the earliest MAX_PLANNED_ALERTS entries', () => {
    const many = habit({
      alert_times: Array.from({ length: 10 }, (_, i) =>
        `${String(8 + i).padStart(2, '0')}:00`,
      ),
    });
    const plan = planAlerts([many], now, 7); // 10 × 7 = 70 candidates
    expect(plan).toHaveLength(MAX_PLANNED_ALERTS);
    // Earliest kept: the last (dropped) candidates are the latest ones.
    expect(plan[plan.length - 1].fireDate.getTime()).toBeLessThan(
      new Date(2026, 6, 7, 17, 0, 0).getTime() + 1,
    );
  });

  it('labels the notification with the habit title (icon-prefixed)', () => {
    const plan = planAlerts([habit({ icon: '🧘', title: 'Meditate' })], now, 1);
    expect(plan[0].title).toBe('🧘 Meditate');
    expect(plan[0].body).toContain('Meditate');
  });
});
