import type { AgendaRow } from '@/lib/history';

export type DayDiff = {
  entering: Set<string>;
  exiting: Set<string>;
  persisting: Set<string>;
};

function habitIdOf(row: AgendaRow): string {
  return row.kind === 'completion' ? row.habit.id : row.habitId;
}

export function diffDayHabits(
  oldRows: AgendaRow[],
  newRows: AgendaRow[],
): DayDiff {
  const oldIds = new Set(oldRows.map(habitIdOf));
  const newIds = new Set(newRows.map(habitIdOf));

  const entering = new Set<string>();
  const exiting = new Set<string>();
  const persisting = new Set<string>();

  for (const id of newIds) {
    if (oldIds.has(id)) persisting.add(id);
    else entering.add(id);
  }
  for (const id of oldIds) {
    if (!newIds.has(id)) exiting.add(id);
  }

  return { entering, exiting, persisting };
}
