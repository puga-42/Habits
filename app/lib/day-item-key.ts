import type { AgendaRow } from './history';

export type Section = 'notCompleted' | 'completed' | 'resting';

// Every item carries the id of the group card it lives in, or the UNGROUPED
// sentinel (see day-items.ts) for habits in no group. Headers are group-scoped
// so a card can have its own Completed/Resting sub-sections, and drag-reorder
// can tell which group+section a row landed in.
export type DayItem =
  | {
      kind: 'group-header';
      groupId: string;
      name: string;
      collapsed: boolean;
      color: string | null;
      streak?: number;
    }
  // Bottom cap of a group card — closes the surface the header opened, so a
  // collapsed card (header + footer) still reads as one pill bar.
  | { kind: 'group-footer'; groupId: string }
  | { kind: 'ungrouped-header'; groupId: string }
  | { kind: 'completed-header'; groupId: string }
  | { kind: 'resting-header'; groupId: string }
  | { kind: 'all-done'; groupId: string }
  | { kind: 'row'; row: AgendaRow; section: Section; groupId: string };

export function dayItemKey(item: DayItem): string {
  if (item.kind === 'group-header') return `__gh-${item.groupId}`;
  if (item.kind === 'group-footer') return `__gf-${item.groupId}`;
  if (item.kind === 'ungrouped-header') return `__uh-${item.groupId}`;
  if (item.kind === 'completed-header') return `__ch-${item.groupId}`;
  if (item.kind === 'resting-header') return `__rh-${item.groupId}`;
  if (item.kind === 'all-done') return `__ad-${item.groupId}`;
  const habitId =
    item.row.kind === 'completion' ? item.row.habit.id : item.row.habitId;
  return `${item.groupId}-${item.section}-${habitId}`;
}
