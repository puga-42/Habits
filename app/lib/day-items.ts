// Day-view list construction — turns a day's AgendaRows into the flat DayItem[]
// the DraggableFlatList renders, grouped into collapsible group cards (top-level)
// with the ungrouped habits trailing at the bottom. Pure + TDD'd; see
// __tests__/day-items.test.ts. (Extracted from day-content.tsx so the grouping
// logic is testable and that component stays presentational.)

import type { DayItem, Section } from './day-item-key';
import { activeGroupIdFor, type GroupMembership, type HabitGroup } from './groups';
import type { Habit } from './habits';
import { partitionRows, type AgendaRow } from './history';

// Sentinel group id for habits that belong to no group on the rendered day.
export const UNGROUPED = '__ungrouped';

type Params = {
  rows: AgendaRow[];
  habitMap: Map<string, Habit>;
  groups: HabitGroup[];
  memberships: GroupMembership[];
  dateIso: string;
  // Group ids (or UNGROUPED) whose Resting sub-section is expanded.
  restingExpanded: Set<string>;
  // Optimistic override of each group's persisted `collapsed` flag.
  collapsedById?: Map<string, boolean>;
  // Group-level streak shown on the card header.
  streakByGroupId?: Map<string, number>;
};

function rowHabitId(row: AgendaRow): string {
  return row.kind === 'completion' ? row.habit.id : row.habitId;
}

export function buildDayItems({
  rows,
  habitMap,
  groups,
  memberships,
  dateIso,
  restingExpanded,
  collapsedById,
  streakByGroupId,
}: Params): DayItem[] {
  // Bucket each row under the group it belonged to on this day (membership
  // window-covering), or UNGROUPED.
  const byGroup = new Map<string, AgendaRow[]>();
  for (const row of rows) {
    const lineageId = habitMap.get(rowHabitId(row))?.lineage_id;
    const gid = lineageId
      ? activeGroupIdFor(memberships, lineageId, dateIso)
      : null;
    const key = gid ?? UNGROUPED;
    const bucket = byGroup.get(key);
    if (bucket) bucket.push(row);
    else byGroup.set(key, [row]);
  }

  const out: DayItem[] = [];
  const sortedGroups = [...groups].sort(
    (a, b) =>
      a.sort_index - b.sort_index || a.created_at.localeCompare(b.created_at),
  );

  let emittedCard = false;
  for (const g of sortedGroups) {
    const groupRows = byGroup.get(g.id);
    if (!groupRows || groupRows.length === 0) continue;
    const collapsed = collapsedById?.get(g.id) ?? g.collapsed;
    out.push({
      kind: 'group-header',
      groupId: g.id,
      name: g.name,
      collapsed,
      color: g.color,
      streak: streakByGroupId?.get(g.id),
    });
    emittedCard = true;
    if (!collapsed) {
      // Inside a group card: no "Completed" divider / "all done" line — completed
      // habits simply sink to the bottom of the card, keeping the order tidy.
      pushSections(out, g.id, groupRows, habitMap, restingExpanded.has(g.id), false);
    }
  }

  // Ungrouped habits trail at the bottom. When at least one group card was
  // emitted, a header marks the boundary (so drag-reorder can attribute the
  // section); with no groups at all, the layout is exactly the legacy flat list.
  const ungrouped = byGroup.get(UNGROUPED);
  if (ungrouped && ungrouped.length > 0) {
    if (emittedCard) out.push({ kind: 'ungrouped-header', groupId: UNGROUPED });
    // The ungrouped pile keeps the legacy "Completed" divider + "all done" line.
    pushSections(out, UNGROUPED, ungrouped, habitMap, restingExpanded.has(UNGROUPED), true);
  }

  return out;
}

// Append a group's rows partitioned into the not-completed / completed / resting
// sub-sections. With `completedDivider` the completed rows get the "Completed"
// header (and an "all done" line when nothing is outstanding) — the legacy
// single-list look, kept for the ungrouped pile. Group cards pass false: the
// completed rows just follow the not-completed ones with no divider.
function pushSections(
  out: DayItem[],
  groupId: string,
  rows: AgendaRow[],
  habitMap: Map<string, Habit>,
  restingIsExpanded: boolean,
  completedDivider: boolean,
): void {
  const { notCompleted, completed, resting } = partitionRows(rows, habitMap);

  if (notCompleted.length > 0) {
    for (const row of notCompleted) {
      out.push({ kind: 'row', row, section: 'notCompleted', groupId });
    }
  } else if (completed.length > 0 && completedDivider) {
    out.push({ kind: 'all-done', groupId });
  }

  if (completed.length > 0) {
    if (completedDivider) out.push({ kind: 'completed-header', groupId });
    for (const row of completed) {
      out.push({ kind: 'row', row, section: 'completed', groupId });
    }
  }

  if (resting.length > 0) {
    out.push({ kind: 'resting-header', groupId });
    if (restingIsExpanded) {
      for (const row of resting) {
        out.push({ kind: 'row', row, section: 'resting', groupId });
      }
    }
  }
}

// The section type re-exported for callers building reorder payloads.
export type { Section };
