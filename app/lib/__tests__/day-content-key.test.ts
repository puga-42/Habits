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

function skip(habitId: string): AgendaRow {
  return { kind: 'skip', habitId, habit: habit(habitId), time: null };
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

function rowItem(row: AgendaRow, section: 'notCompleted' | 'completed' = 'notCompleted'): DayItem {
  return { kind: 'row', row, section };
}

describe('dayItemKey', () => {
  it('returns stable key for completed-header', () => {
    expect(dayItemKey({ kind: 'completed-header' })).toBe('__ch');
  });

  it('returns stable key for all-done', () => {
    expect(dayItemKey({ kind: 'all-done' })).toBe('__ad');
  });

  it('returns same key for scheduled and completion of same habit', () => {
    const scheduledKey = dayItemKey(rowItem(scheduled('h1')));
    const completionKey = dayItemKey(rowItem(completion('h1', 'c99')));
    expect(scheduledKey).toBe(completionKey);
  });

  it('returns same key for scheduled and skip of same habit', () => {
    const scheduledKey = dayItemKey(rowItem(scheduled('h1')));
    const skipKey = dayItemKey(rowItem(skip('h1')));
    expect(scheduledKey).toBe(skipKey);
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

  it('key does not change across sections', () => {
    const inProgress = dayItemKey(rowItem(scheduled('h1'), 'notCompleted'));
    const completed = dayItemKey(rowItem(scheduled('h1'), 'completed'));
    expect(inProgress).toBe(completed);
  });
});
