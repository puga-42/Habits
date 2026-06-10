import type { AgendaRow } from './history';

export type Section = 'notCompleted' | 'completed';

export type DayItem =
  | { kind: 'completed-header' }
  | { kind: 'all-done' }
  | { kind: 'row'; row: AgendaRow; section: Section };

export function dayItemKey(item: DayItem): string {
  if (item.kind === 'completed-header') return '__ch';
  if (item.kind === 'all-done') return '__ad';
  const habitId =
    item.row.kind === 'completion' ? item.row.habit.id : item.row.habitId;
  return `h-${habitId}`;
}
