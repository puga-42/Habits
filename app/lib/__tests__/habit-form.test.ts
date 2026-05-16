import { draftToInsert, habitToDraft } from '../habit-form';
import type { Habit } from '../habits';

const scheduledHabit: Habit = {
  id: 'h1',
  lineage_id: 'l1',
  owner_id: 'u1',
  kind: 'scheduled',
  title: 'Meditate',
  description: 'Focus on breathing for 10 min',
  color: '#7c3aed',
  icon: '🧘',
  visibility: 'private',
  timezone: 'America/New_York',
  dtstart: '2026-01-01T05:00:00.000Z',
  rrule: 'FREQ=DAILY',
  until: null,
  target_count: null,
  target_period: null,
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
});
