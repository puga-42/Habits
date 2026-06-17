// Read-only day agenda for another user's profile. Renders the owner's habits
// for one day the way the home day-view does — completed habits with a ✓, due-
// but-not-logged habits as a neutral dimmed ○, flex as period progress — but
// non-interactive: no completing, swiping, or reordering someone else's data.
// Reuses the pure partitionRows + the AgendaRow pill (which renders the dimmed,
// non-actionable state automatically when no onTrailingPress is given).

import { StyleSheet, View } from 'react-native';

import { AgendaRow } from '@/components/agenda-row';
import { ThemedText } from '@/components/themed-text';
import type { Habit } from '@/lib/habits';
import {
  partitionRows,
  type AgendaRow as AgendaRowT,
  type DayGroup,
} from '@/lib/history';

type Props = {
  group: DayGroup | undefined;
  habitMap: Map<string, Habit>;
  onHabitPress: (habitId: string) => void;
};

function rowHabitId(row: AgendaRowT): string {
  return row.kind === 'completion' ? row.habit.id : row.habitId;
}

function rowKey(row: AgendaRowT): string {
  return `${row.kind}:${row.kind === 'completion' ? row.id : row.habitId}`;
}

export function ProfileDayAgenda({ group, habitMap, onHabitPress }: Props) {
  const rows = group?.rows ?? [];

  if (rows.length === 0) {
    return (
      <View style={styles.empty}>
        <ThemedText style={styles.emptyText}>Nothing scheduled for this day.</ThemedText>
      </View>
    );
  }

  const { notCompleted, completed } = partitionRows(rows, habitMap);

  const renderRow = (row: AgendaRowT) => (
    <View key={rowKey(row)} style={styles.rowWrap}>
      <AgendaRow row={row} onPress={() => onHabitPress(rowHabitId(row))} />
    </View>
  );

  return (
    <View style={styles.list}>
      {notCompleted.map(renderRow)}
      {completed.length > 0 && (
        <View style={styles.completedHeader}>
          <View style={styles.rule} />
          <ThemedText style={styles.completedLabel}>Completed</ThemedText>
          <View style={styles.rule} />
        </View>
      )}
      {completed.map(renderRow)}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, paddingTop: 6, gap: 10 },
  rowWrap: {},
  empty: { paddingVertical: 28, alignItems: 'center' },
  emptyText: { opacity: 0.55, fontSize: 15 },
  completedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  rule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(127,127,127,0.3)',
  },
  completedLabel: {
    fontSize: 12,
    opacity: 0.55,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});
