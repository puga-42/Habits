import { dayItemKey, type DayItem } from '../day-item-key';
import type { AgendaRow } from '../history';

const habit = (id: string) => ({
  id,
  title: id,
  description: null,
  icon: null,
  color: null,
  unit: 'count' as const,
});

function scheduled(habitId: string): AgendaRow {
  return { kind: 'scheduled', habitId, habit: habit(habitId), time: null };
}

function completion(habitId: string, completionId: string): AgendaRow {
  return {
    kind: 'completion',
    id: completionId,
    habit: habit(habitId),
    time: null,
    isFlex: false,
  };
}

function rest(habitId: string): AgendaRow {
  return {
    kind: 'rest',
    habitId,
    habit: habit(habitId),
    time: null,
    completed: false,
    completionId: null,
  };
}

function flex(habitId: string): AgendaRow {
  return {
    kind: 'flex',
    habitId,
    habit: habit(habitId),
    time: null,
    period: 'week',
    count: 1,
    target: 3,
  };
}

function rowItem(
  row: AgendaRow,
  section: 'notCompleted' | 'completed' = 'notCompleted',
  groupId = '__ungrouped',
): DayItem {
  return { kind: 'row', row, section, groupId };
}

describe('dayItemKey', () => {
  it('returns group-scoped key for completed-header', () => {
    expect(dayItemKey({ kind: 'completed-header', groupId: '__ungrouped' })).toBe(
      '__ch-__ungrouped',
    );
  });

  it('returns group-scoped key for all-done', () => {
    expect(dayItemKey({ kind: 'all-done', groupId: '__ungrouped' })).toBe(
      '__ad-__ungrouped',
    );
  });

  it('the same habit in different group cards gets distinct keys', () => {
    const inG1 = dayItemKey(rowItem(scheduled('h1'), 'notCompleted', 'G1'));
    const inG2 = dayItemKey(rowItem(scheduled('h1'), 'notCompleted', 'G2'));
    expect(inG1).not.toBe(inG2);
  });

  it('returns same key for scheduled and completion of same habit', () => {
    const scheduledKey = dayItemKey(rowItem(scheduled('h1')));
    const completionKey = dayItemKey(rowItem(completion('h1', 'c99')));
    expect(scheduledKey).toBe(completionKey);
  });

  it('returns same key for scheduled and rest of same habit in the same section', () => {
    const scheduledKey = dayItemKey(rowItem(scheduled('h1')));
    const restKey = dayItemKey(rowItem(rest('h1')));
    expect(scheduledKey).toBe(restKey);
  });

  it('returns same key for flex and completion of same habit', () => {
    const flexKey = dayItemKey(rowItem(flex('h1')));
    const completionKey = dayItemKey(rowItem(completion('h1', 'c42')));
    expect(flexKey).toBe(completionKey);
  });

  it('returns different keys for different habits', () => {
    const key1 = dayItemKey(rowItem(scheduled('h1')));
    const key2 = dayItemKey(rowItem(scheduled('h2')));
    expect(key1).not.toBe(key2);
  });

  it('key is section-scoped, so it differs across sections', () => {
    // The resting feature made keys section-prefixed so a habit can appear in
    // more than one section (e.g. a rest row that is also completable) with a
    // distinct list identity. Moving between sections is a remount, by design.
    const inProgress = dayItemKey(rowItem(scheduled('h1'), 'notCompleted'));
    const completed = dayItemKey(rowItem(scheduled('h1'), 'completed'));
    expect(inProgress).not.toBe(completed);
  });
});
