import { describeGoal, describeRepeat, draftToInsert, habitToDraft } from '../habit-form';
import type { Habit } from '../habits';

const scheduledHabit: Habit = {
  id: 'h1',
  lineage_id: 'l1',
  owner_id: 'u1',
  kind: 'scheduled',
  title: 'Meditate',
  description: 'Focus on breathing for 10 min',
  color: '#0ABAB5',
  icon: '🧘',
  visibility: 'private',
  timezone: 'America/New_York',
  dtstart: '2026-01-01T05:00:00.000Z',
  rrule: 'FREQ=DAILY',
  until: null,
  target_count: null,
  target_period: null,
  unit: 'count',
  target_seconds: null,
  display_unit: null,
  sort_index: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  deleted_at: null,
};

describe('habitToDraft', () => {
  it('populates description from habit', () => {
    const draft = habitToDraft(scheduledHabit);
    expect(draft.description).toBe('Focus on breathing for 10 min');
  });

  it('defaults description to empty string when null', () => {
    const draft = habitToDraft({ ...scheduledHabit, description: null });
    expect(draft.description).toBe('');
  });
});

describe('draftToInsert', () => {
  it('includes trimmed description in scheduled insert', () => {
    const draft = habitToDraft(scheduledHabit);
    draft.description = '  Morning meditation  ';
    const insert = draftToInsert(draft);
    expect(insert.description).toBe('Morning meditation');
  });

  it('sets description to null when empty', () => {
    const draft = habitToDraft(scheduledHabit);
    draft.description = '   ';
    const insert = draftToInsert(draft);
    expect(insert.description).toBeNull();
  });

  it('includes description in flex insert', () => {
    const flexHabit: Habit = {
      ...scheduledHabit,
      kind: 'flex',
      description: 'Stay hydrated',
      target_count: 8,
      target_period: 'day',
    };
    const draft = habitToDraft(flexHabit);
    const insert = draftToInsert(draft);
    expect(insert.description).toBe('Stay hydrated');
  });

  it('includes adopted_from_user_id when set', () => {
    const draft = habitToDraft(scheduledHabit);
    draft.adoptedFromUserId = 'user-abc';
    const insert = draftToInsert(draft);
    expect(insert.adopted_from_user_id).toBe('user-abc');
  });

  it('omits adopted_from_user_id when null', () => {
    const draft = habitToDraft(scheduledHabit);
    expect(draft.adoptedFromUserId).toBeNull();
    const insert = draftToInsert(draft);
    expect(insert.adopted_from_user_id).toBeUndefined();
  });

  it('includes adopted_from_user_id in flex insert', () => {
    const flexHabit: Habit = {
      ...scheduledHabit,
      kind: 'flex',
      target_count: 3,
      target_period: 'week',
    };
    const draft = habitToDraft(flexHabit);
    draft.adoptedFromUserId = 'user-xyz';
    const insert = draftToInsert(draft);
    expect(insert.adopted_from_user_id).toBe('user-xyz');
  });
});

describe('describeGoal', () => {
  it('count plural', () => {
    const d = habitToDraft(scheduledHabit);
    d.unit = 'count';
    d.targetCount = 3;
    expect(describeGoal(d)).toBe('3 times');
  });
  it('count singular', () => {
    const d = habitToDraft(scheduledHabit);
    d.unit = 'count';
    d.targetCount = 1;
    expect(describeGoal(d)).toBe('1 time');
  });
  it('time in minutes', () => {
    const d = habitToDraft(scheduledHabit);
    d.unit = 'time';
    d.targetValue = 30;
    d.displayUnit = 'minutes';
    expect(describeGoal(d)).toBe('30 minutes');
  });
  it('time singular hour', () => {
    const d = habitToDraft(scheduledHabit);
    d.unit = 'time';
    d.targetValue = 1;
    d.displayUnit = 'hours';
    expect(describeGoal(d)).toBe('1 hour');
  });
});

describe('describeRepeat', () => {
  it('scheduled uses the recurrence description', () => {
    const d = habitToDraft(scheduledHabit);
    d.kind = 'scheduled';
    d.recurrence = { pattern: 'daily', byDays: [], interval: 1 };
    expect(describeRepeat(d)).toBe('Every day');
  });
  it('flex reads as per period', () => {
    const d = habitToDraft(scheduledHabit);
    d.kind = 'flex';
    d.targetPeriod = 'week';
    expect(describeRepeat(d)).toBe('Per week');
  });
});

describe('habitToDraft adoption', () => {
  it('sets adoptedFromUserId to null by default', () => {
    const draft = habitToDraft(scheduledHabit);
    expect(draft.adoptedFromUserId).toBeNull();
  });
});
