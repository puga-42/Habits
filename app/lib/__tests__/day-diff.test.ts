import { diffDayHabits } from '../day-diff';
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

describe('diffDayHabits', () => {
  it('returns empty sets when both arrays are empty', () => {
    const result = diffDayHabits([], []);
    expect(result.entering.size).toBe(0);
    expect(result.exiting.size).toBe(0);
    expect(result.persisting.size).toBe(0);
  });

  it('returns all persisting when rows are identical', () => {
    const rows = [scheduled('h1'), scheduled('h2')];
    const result = diffDayHabits(rows, rows);
    expect(result.persisting).toEqual(new Set(['h1', 'h2']));
    expect(result.entering.size).toBe(0);
    expect(result.exiting.size).toBe(0);
  });

  it('detects entering habits', () => {
    const result = diffDayHabits([], [scheduled('h1'), scheduled('h2')]);
    expect(result.entering).toEqual(new Set(['h1', 'h2']));
    expect(result.exiting.size).toBe(0);
    expect(result.persisting.size).toBe(0);
  });

  it('detects exiting habits', () => {
    const result = diffDayHabits([scheduled('h1'), scheduled('h2')], []);
    expect(result.exiting).toEqual(new Set(['h1', 'h2']));
    expect(result.entering.size).toBe(0);
    expect(result.persisting.size).toBe(0);
  });

  it('handles mixed overlap', () => {
    const oldRows = [scheduled('h1'), scheduled('h2'), scheduled('h3')];
    const newRows = [scheduled('h2'), scheduled('h3'), scheduled('h4')];
    const result = diffDayHabits(oldRows, newRows);
    expect(result.exiting).toEqual(new Set(['h1']));
    expect(result.entering).toEqual(new Set(['h4']));
    expect(result.persisting).toEqual(new Set(['h2', 'h3']));
  });

  it('handles same habitId across different row kinds', () => {
    const oldRows = [scheduled('h1')];
    const newRows = [completion('h1', 'c1')];
    const result = diffDayHabits(oldRows, newRows);
    expect(result.persisting).toEqual(new Set(['h1']));
    expect(result.entering.size).toBe(0);
    expect(result.exiting.size).toBe(0);
  });

  it('extracts habitId from flex rows', () => {
    const oldRows = [flex('h1')];
    const newRows = [flex('h1'), scheduled('h2')];
    const result = diffDayHabits(oldRows, newRows);
    expect(result.persisting).toEqual(new Set(['h1']));
    expect(result.entering).toEqual(new Set(['h2']));
  });
});
