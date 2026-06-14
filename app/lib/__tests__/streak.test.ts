import { computeStreak, type ScheduleSegment, type StreakInput } from '../streak';

// June 2026: the 1st is a Monday, so the 8th–12th are Mon–Fri and the 12th is a
// Friday. `now` is local noon on Fri June 12 throughout. dtstart uses noon UTC
// so each occurrence lands on the same calendar day in any reasonable timezone.
const NOW = new Date(2026, 5, 12, 12, 0, 0);

function seg(o: Partial<ScheduleSegment> = {}): ScheduleSegment {
  return {
    rrule: 'FREQ=DAILY',
    dtstart: '2026-06-01T12:00:00Z',
    until: null,
    target_count: null,
    target_period: null,
    ...o,
  };
}

// A single-segment scheduled lineage. `rrule` overrides the lone segment's rule;
// `segments` replaces the whole list (for fork/multi-era cases).
function scheduled(o: {
  rrule?: string;
  segments?: ScheduleSegment[];
  completion_dates?: string[];
  skip_dates?: string[];
} = {}): StreakInput {
  return {
    kind: 'scheduled',
    segments: o.segments ?? [seg({ rrule: o.rrule ?? 'FREQ=DAILY' })],
    completion_dates: o.completion_dates ?? [],
    skip_dates: o.skip_dates ?? [],
  };
}

// A single-segment flex lineage. Flex never forks in production (flex edits use
// applyEditAll), so one segment is the real-world shape; the multi-segment case
// below is forward-looking.
function flex(o: {
  target_count?: number;
  target_period?: ScheduleSegment['target_period'];
  segments?: ScheduleSegment[];
  completion_dates?: string[];
  skip_dates?: string[];
} = {}): StreakInput {
  return {
    kind: 'flex',
    segments: o.segments ?? [
      seg({
        rrule: null,
        dtstart: null,
        target_count: o.target_count ?? 3,
        target_period: o.target_period ?? 'week',
      }),
    ],
    completion_dates: o.completion_dates ?? [],
    skip_dates: o.skip_dates ?? [],
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

describe('computeStreak — scheduled lineage with a fork (multi-segment)', () => {
  it('keeps the streak continuous across a daily→weekly schedule change', () => {
    // Era 1: DAILY, June 8–11 (capped). Era 2: WEEKLY on Friday from June 12.
    // The fork sets the new row's dtstart to the edit moment (June 12), so a
    // single-segment expansion off the active (weekly) row would only yield
    // 06-05 and 06-12 — missing the daily era entirely and collapsing to 1.
    const input = scheduled({
      segments: [
        seg({
          rrule: 'FREQ=DAILY',
          dtstart: '2026-06-08T12:00:00Z',
          until: '2026-06-11T12:00:00Z',
        }),
        seg({
          rrule: 'FREQ=WEEKLY;BYDAY=FR',
          dtstart: '2026-06-12T12:00:00Z',
          until: null,
        }),
      ],
      completion_dates: [
        '2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11', '2026-06-12',
      ],
    });
    // Union of occurrences: 06-08,09,10,11 (daily) + 06-12 (weekly) → all five
    // completed and consecutive → streak 5.
    expect(computeStreak(input, NOW)).toBe(5);
  });

  it('matches a single segment when the fork did not change the schedule', () => {
    const single = scheduled({
      completion_dates: ['2026-06-10', '2026-06-11', '2026-06-12'],
    });
    const forkedSameRule = scheduled({
      segments: [
        seg({ rrule: 'FREQ=DAILY', dtstart: '2026-06-01T12:00:00Z', until: '2026-06-09T12:00:00Z' }),
        seg({ rrule: 'FREQ=DAILY', dtstart: '2026-06-10T12:00:00Z', until: null }),
      ],
      completion_dates: ['2026-06-10', '2026-06-11', '2026-06-12'],
    });
    expect(computeStreak(forkedSameRule, NOW)).toBe(computeStreak(single, NOW));
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

  it('judges each period against the target active during that period', () => {
    // Forward-looking: target dropped 3/week → 1/week at the June 8 week.
    const input = flex({
      segments: [
        seg({ rrule: null, dtstart: null, until: '2026-06-07T12:00:00Z', target_count: 3, target_period: 'week' }),
        seg({ rrule: null, dtstart: '2026-06-08T12:00:00Z', until: null, target_count: 1, target_period: 'week' }),
      ],
      completion_dates: [
        '2026-06-08', // current week vs target 1 → hit
        '2026-06-01', '2026-06-01', '2026-06-01', // prior week vs target 3 → hit
        '2026-05-25', '2026-05-25', // vs target 3 → miss
      ],
    });
    expect(computeStreak(input, NOW)).toBe(2);
  });
});
