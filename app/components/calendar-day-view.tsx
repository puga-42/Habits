// Day view: shows one day at a time, with horizontal swipe (via PagerView)
// to move +/-1 day. The pager keeps three pages (prev/current/next) and
// resets to the middle after each swipe.

import { useEffect, useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import PagerView from 'react-native-pager-view';

import { AgendaRow } from '@/components/agenda-row';
import { ThemedText } from '@/components/themed-text';
import { isoDate } from '@/lib/habits';
import type { AgendaRow as AgendaRowT, DayGroup } from '@/lib/history';

type Props = {
  anchorDate: Date;
  dayGroups: DayGroup[];
  onAnchorChange: (date: Date) => void;
  onRowPress: (row: AgendaRowT, dateIso: string) => void;
  onRowLongPress: (row: AgendaRowT, dateIso: string) => void;
};

export function CalendarDayView({
  anchorDate,
  dayGroups,
  onAnchorChange,
  onRowPress,
  onRowLongPress,
}: Props) {
  const pagerRef = useRef<PagerView>(null);

  // Three pages: yesterday, today, tomorrow (relative to current anchor).
  const pageDates = useMemo(() => {
    const out: Date[] = [];
    for (let offset = -1; offset <= 1; offset++) {
      const d = new Date(anchorDate);
      d.setDate(anchorDate.getDate() + offset);
      d.setHours(0, 0, 0, 0);
      out.push(d);
    }
    return out;
  }, [anchorDate]);

  // After the anchor changes (because of a swipe), reset the pager back to
  // its middle slot so the user can keep swiping in either direction.
  useEffect(() => {
    pagerRef.current?.setPageWithoutAnimation(1);
  }, [anchorDate]);

  const groupByIso = useMemo(() => {
    const m = new Map<string, DayGroup>();
    for (const g of dayGroups) m.set(g.date, g);
    return m;
  }, [dayGroups]);

  return (
    <PagerView
      ref={pagerRef}
      initialPage={1}
      style={styles.pager}
      onPageSelected={(e) => {
        const idx = e.nativeEvent.position;
        if (idx === 1) return;
        onAnchorChange(pageDates[idx]);
      }}>
      {pageDates.map((d, idx) => (
        // Stable keys (idx) so anchor jumps update content in place rather
        // than remounting pages. Remounting causes PagerView to reset to
        // position 0 and fire onPageSelected, which would feed back into
        // onAnchorChange and loop forever.
        <View key={idx} style={styles.page}>
          <DayContent
            date={d}
            group={groupByIso.get(isoDate(d))}
            onRowPress={onRowPress}
            onRowLongPress={onRowLongPress}
          />
        </View>
      ))}
    </PagerView>
  );
}

function DayContent({
  date,
  group,
  onRowPress,
  onRowLongPress,
}: {
  date: Date;
  group: DayGroup | undefined;
  onRowPress: (row: AgendaRowT, dateIso: string) => void;
  onRowLongPress: (row: AgendaRowT, dateIso: string) => void;
}) {
  const iso = isoDate(date);
  const rows = group?.rows ?? [];
  const morning: AgendaRowT[] = [];
  const afternoon: AgendaRowT[] = [];
  const evening: AgendaRowT[] = [];
  const untimed: AgendaRowT[] = [];

  for (const row of rows) {
    if (!row.time) {
      untimed.push(row);
      continue;
    }
    const h = row.time.getHours();
    if (h < 12) morning.push(row);
    else if (h < 18) afternoon.push(row);
    else evening.push(row);
  }

  const isEmpty = rows.length === 0;

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      {isEmpty ? (
        <View style={styles.emptyState}>
          <ThemedText style={styles.emptyText}>Nothing scheduled for this day.</ThemedText>
        </View>
      ) : (
        <>
          {renderSection('Morning', morning, iso, onRowPress, onRowLongPress)}
          {renderSection('Afternoon', afternoon, iso, onRowPress, onRowLongPress)}
          {renderSection('Evening', evening, iso, onRowPress, onRowLongPress)}
          {renderSection('Other', untimed, iso, onRowPress, onRowLongPress)}
        </>
      )}
    </ScrollView>
  );
}

function renderSection(
  title: string,
  rows: AgendaRowT[],
  iso: string,
  onRowPress: (row: AgendaRowT, dateIso: string) => void,
  onRowLongPress: (row: AgendaRowT, dateIso: string) => void,
) {
  if (rows.length === 0) return null;
  return (
    <View key={title} style={styles.section}>
      <ThemedText style={styles.sectionHeader}>{title}</ThemedText>
      {rows.map((row, i) => (
        <AgendaRow
          key={`${title}-${i}`}
          row={row}
          onPress={() => onRowPress(row, iso)}
          onLongPress={() => onRowLongPress(row, iso)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pager: { flex: 1 },
  page: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 100 },
  section: { gap: 4, marginBottom: 12 },
  sectionHeader: {
    fontSize: 12,
    opacity: 0.55,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 8,
    marginBottom: 4,
  },
  emptyState: { alignItems: 'center', paddingVertical: 64 },
  emptyText: { opacity: 0.55, fontSize: 15 },
});
