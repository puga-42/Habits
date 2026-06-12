import { computeStreak, type StreakInput } from '../streak';

// June 2026: the 1st is a Monday, so the 8th–12th are Mon–Fri and the 12th is a
// Friday. `now` is local noon on Fri June 12 throughout. dtstart uses noon UTC
// so each occurrence lands on the same calendar day in any reasonable timezone.
const NOW = new Date(2026, 5, 12, 12, 0, 0);

function scheduled(overrides: Partial<StreakInput> = {}): StreakInput {
  return {
    kind: 'scheduled',
    rrule: 'FREQ=DAILY',
    dtstart: '2026-06-01T12:00:00Z',
    until: null,
    target_count: null,
    target_period: null,
    completion_dates: [],
    skip_dates: [],
    ...overrides,
  };
}

function flex(overrides: Partial<StreakInput> = {}): StreakInput {
  return {
    kind: 'flex',
    rrule: null,
    dtstart: null,
    until: null,
    target_count: 3,
    target_period: 'week',
    completion_dates: [],
    skip_dates: [],
    ...overrides,
  };
}

describe('computeStreak — scheduled (daily)', () => {
  it('counts consecutive completed occurrences back from today', () => {
    const input = scheduled({
      completion_dates: ['2026-06-08', '2026-06-10', '2026-06-11', '2026-06-12'],
    });
    // 06-12, 06-11, 06-10 complete; 06-09 missed → breaks. 06-08 doesn't count.
    expect(computeStreak(input, NOW)).toBe(3);
  });

  it('does not break when today is not yet completed', () => {
    const input = scheduled({
      completion_dates: ['2026-06-09', '2026-06-10', '2026-06-11'],
    });
    // 06-12 (today) uncompleted is neutral; 06-11/10/09 complete; 06-08 missed.
    expect(computeStreak(input, NOW)).toBe(3);
  });

  it('treats a skip override as neutral — it neither counts nor breaks', () => {
    const input = scheduled({
      completion_dates: ['2026-06-08', '2026-06-10', '2026-06-11', '2026-06-12'],
      skip_dates: ['2026-06-09'],
    });
    // 06-12,11,10 complete; 06-09 skip (neutral); 06-08 complete; 06-07 missed.
    expect(computeStreak(input, NOW)).toBe(4);
  });

  it('returns 0 when the most recent occurrence before today was missed', () => {
    const input = scheduled({ completion_dates: ['2026-06-09'] });
    // 06-12 today neutral; 06-11 missed → break. Streak 0.
    expect(computeStreak(input, NOW)).toBe(0);
  });

  it('returns 0 with no completions', () => {
    expect(computeStreak(scheduled(), NOW)).toBe(0);
  });
});

describe('computeStreak — scheduled (weekday cadence)', () => {
  it('does not count weekends as misses', () => {
    const input = scheduled({
      rrule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
      completion_dates: [
        '2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11', '2026-06-12',
      ],
    });
    // Mon–Fri all complete; the weekend (06-06/07) isn't scheduled, so the
    // streak runs back to the prior Friday 06-05, which was missed → break.
    expect(computeStreak(input, NOW)).toBe(5);
  });
});

describe('computeStreak — flex', () => {
  it('counts consecutive target-met periods back from the current week', () => {
    const input = flex({
      completion_dates: [
        '2026-06-08', '2026-06-08', '2026-06-08', // current week: 3 → hit
        '2026-06-01', '2026-06-01', '2026-06-01', // last week: 3 → hit
        '2026-05-25', '2026-05-25', // 2 → miss
      ],
    });
    expect(computeStreak(input, NOW)).toBe(2);
  });

  it('does not break when the current period is in progress and not yet hit', () => {
    const input = flex({
      completion_dates: [
        '2026-06-08', // current week: 1 → not yet hit, neutral
        '2026-06-01', '2026-06-01', '2026-06-01', // hit
        '2026-05-25', '2026-05-25', '2026-05-25', // hit
        '2026-05-18', // 1 → miss
      ],
    });
    expect(computeStreak(input, NOW)).toBe(2);
  });

  it('counts the current period when it is already hit', () => {
    const input = flex({
      completion_dates: [
        '2026-06-08', '2026-06-08', '2026-06-08', // hit
        '2026-06-01', '2026-06-01', '2026-06-01', // hit
      ],
    });
    expect(computeStreak(input, NOW)).toBe(2);
  });

  it('supports a daily target period', () => {
    const input = flex({
      target_period: 'day',
      target_count: 1,
      completion_dates: ['2026-06-12', '2026-06-11'],
    });
    // 06-12 hit, 06-11 hit, 06-10 none → break.
    expect(computeStreak(input, NOW)).toBe(2);
  });

  it('returns 0 with no completions', () => {
    expect(computeStreak(flex(), NOW)).toBe(0);
  });
});
