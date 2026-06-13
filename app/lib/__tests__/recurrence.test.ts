import {
  buildRrule,
  describeRrule,
  parseRrule,
  type RecurrenceState,
} from '../recurrence';

function s(
  pattern: RecurrenceState['pattern'],
  byDays: RecurrenceState['byDays'] = [],
  interval = 1,
): RecurrenceState {
  return { pattern, byDays, interval };
}

describe('buildRrule', () => {
  it('oneoff → FREQ=DAILY;COUNT=1', () => {
    expect(buildRrule(s('oneoff'))).toBe('FREQ=DAILY;COUNT=1');
  });
  it('daily', () => {
    expect(buildRrule(s('daily'))).toBe('FREQ=DAILY');
  });
  it('weekday', () => {
    expect(buildRrule(s('weekday'))).toBe('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR');
  });
  it('weekly with selected days', () => {
    expect(buildRrule(s('weekly', ['MO', 'WE', 'FR']))).toBe(
      'FREQ=WEEKLY;BYDAY=MO,WE,FR',
    );
  });
  it('weekly with no days defaults to Monday', () => {
    expect(buildRrule(s('weekly', []))).toBe('FREQ=WEEKLY;BYDAY=MO');
  });
  it('interval', () => {
    expect(buildRrule(s('interval', [], 3))).toBe('FREQ=DAILY;INTERVAL=3');
  });
  it('interval below 1 clamps to 1', () => {
    expect(buildRrule(s('interval', [], 0))).toBe('FREQ=DAILY;INTERVAL=1');
  });
  it('monthly', () => {
    expect(buildRrule(s('monthly'))).toBe('FREQ=MONTHLY');
  });
});

describe('describeRrule', () => {
  it('oneoff', () => {
    expect(describeRrule(s('oneoff'))).toBe("Doesn't repeat");
  });
  it('daily', () => {
    expect(describeRrule(s('daily'))).toBe('Every day');
  });
  it('weekday', () => {
    expect(describeRrule(s('weekday'))).toBe('Every weekday');
  });
  it('weekly with specific days', () => {
    expect(describeRrule(s('weekly', ['MO', 'WE', 'FR']))).toBe(
      'Every Mon, Wed, Fri',
    );
  });
  it('weekly with all 7 days reads as Every day', () => {
    expect(
      describeRrule(s('weekly', ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'])),
    ).toBe('Every day');
  });
  it('interval of 1 reads as Every day', () => {
    expect(describeRrule(s('interval', [], 1))).toBe('Every day');
  });
  it('interval > 1', () => {
    expect(describeRrule(s('interval', [], 3))).toBe('Every 3 days');
  });
  it('monthly', () => {
    expect(describeRrule(s('monthly'))).toBe('Monthly');
  });
});

describe('parseRrule', () => {
  it('oneoff', () => {
    expect(parseRrule('FREQ=DAILY;COUNT=1')).toEqual({
      pattern: 'oneoff',
      byDays: [],
      interval: 1,
    });
  });
  it('daily', () => {
    expect(parseRrule('FREQ=DAILY').pattern).toBe('daily');
  });
  it('weekday', () => {
    expect(parseRrule('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR').pattern).toBe('weekday');
  });
  it('weekly with custom days', () => {
    const r = parseRrule('FREQ=WEEKLY;BYDAY=MO,FR');
    expect(r.pattern).toBe('weekly');
    expect(r.byDays).toEqual(['MO', 'FR']);
  });
  it('interval', () => {
    const r = parseRrule('FREQ=DAILY;INTERVAL=3');
    expect(r.pattern).toBe('interval');
    expect(r.interval).toBe(3);
  });
  it('monthly', () => {
    expect(parseRrule('FREQ=MONTHLY').pattern).toBe('monthly');
  });
  it('empty rrule defaults to daily', () => {
    expect(parseRrule('').pattern).toBe('daily');
  });
  it('unknown rrule defaults to daily', () => {
    expect(parseRrule('FREQ=YEARLY').pattern).toBe('daily');
  });
});

describe('monthlyDays (specific days of month)', () => {
  const md = (days: number[]): RecurrenceState => ({
    pattern: 'monthlyDays',
    byDays: [],
    interval: 1,
    byMonthDays: days,
  });

  it('builds BYMONTHDAY sorted ascending', () => {
    expect(buildRrule(md([15, 1]))).toBe('FREQ=MONTHLY;BYMONTHDAY=1,15');
  });
  it('falls back to day 1 when none selected', () => {
    expect(buildRrule(md([]))).toBe('FREQ=MONTHLY;BYMONTHDAY=1');
  });
  it('describes with ordinals', () => {
    expect(describeRrule(md([1, 15]))).toBe('Monthly on the 1st, 15th');
  });
  it('describes 21st/22nd/23rd correctly', () => {
    expect(describeRrule(md([21, 22, 23]))).toBe('Monthly on the 21st, 22nd, 23rd');
  });
  it('round-trips through parse', () => {
    expect(parseRrule('FREQ=MONTHLY;BYMONTHDAY=1,15')).toEqual({
      pattern: 'monthlyDays',
      byDays: [],
      interval: 1,
      byMonthDays: [1, 15],
    });
  });
});
