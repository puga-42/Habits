import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { DayContent } from '@/components/day-content';
import type { Section } from '@/lib/day-item-key';
import { isoDate, type Habit } from '@/lib/habits';
import { isDayFuture, type AgendaRow as AgendaRowT, type DayGroup, type SwipeAction } from '@/lib/history';

type Props = {
  anchorDate: Date;
  today: Date;
  habits: Habit[];
  dayGroups: DayGroup[];
  flexProgressByHabitId: Map<string, { count: number; target: number }>;
  timeProgressByHabitId: Map<string, number>;
  activeTimerHabitId?: string | null;
  onRowPress: (row: AgendaRowT, dateIso: string) => void;
  onPillPress?: (row: AgendaRowT, dateIso: string) => void;
  onSwipeAction: (row: AgendaRowT, dateIso: string, action: SwipeAction) => void;
  onReorderSection: (dateIso: string, section: Section, newRows: AgendaRowT[]) => void;
};

export function CalendarDayView({
  anchorDate,
  today,
  habits,
  dayGroups,
  flexProgressByHabitId,
  timeProgressByHabitId,
  activeTimerHabitId,
  onRowPress,
  onPillPress,
  onSwipeAction,
  onReorderSection,
}: Props) {
  const anchorIso = isoDate(anchorDate);
  const todayIso = isoDate(today);
  const isFuture = isDayFuture(anchorIso, todayIso);

  const groupByIso = useMemo(() => {
    const m = new Map<string, DayGroup>();
    for (const g of dayGroups) m.set(g.date, g);
    return m;
  }, [dayGroups]);

  const habitMap = useMemo(() => {
    const m = new Map<string, Habit>();
    for (const h of habits) m.set(h.id, h);
    return m;
  }, [habits]);

  return (
    <View style={styles.root}>
      <DayContent
        date={anchorDate}
        group={groupByIso.get(anchorIso)}
        habitMap={habitMap}
        flexProgressByHabitId={flexProgressByHabitId}
        timeProgressByHabitId={timeProgressByHabitId}
        activeTimerHabitId={activeTimerHabitId}
        isFuture={isFuture}
        onRowPress={onRowPress}
        onPillPress={onPillPress}
        onSwipeAction={onSwipeAction}
        onReorderSection={onReorderSection}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
