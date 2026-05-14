// Schedule view: continuous chronological list of day sections. User can
// load earlier days via the header button, and loads more future days
// automatically as they scroll near the bottom.

import { useMemo } from 'react';
import { Pressable, SectionList, StyleSheet, View } from 'react-native';

import { AgendaRow } from '@/components/agenda-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import type { AgendaRow as AgendaRowT, DayGroup } from '@/lib/history';

type EmptyItem = { kind: 'empty-day' };
type Item = AgendaRowT | EmptyItem;

type Props = {
  dayGroups: DayGroup[];
  todayIso: string;
  onLoadEarlier: () => void;
  onLoadMore: () => void;
  onRowPress: (row: AgendaRowT, dateIso: string) => void;
  onRowLongPress: (row: AgendaRowT, dateIso: string) => void;
};

export function CalendarScheduleView({
  dayGroups,
  todayIso,
  onLoadEarlier,
  onLoadMore,
  onRowPress,
  onRowLongPress,
}: Props) {
  const sections = useMemo(
    () =>
      dayGroups.map((g) => ({
        title: g.date,
        data: g.rows.length > 0 ? (g.rows as Item[]) : [{ kind: 'empty-day' } as const],
      })),
    [dayGroups],
  );

  return (
    <SectionList
      sections={sections}
      stickySectionHeadersEnabled
      keyExtractor={(item, idx) =>
        item.kind === 'completion' ? item.id : `${idx}-${item.kind}`
      }
      ListHeaderComponent={
        <Pressable
          onPress={onLoadEarlier}
          style={({ pressed }) => [styles.loadEarlier, pressed && styles.pressed]}>
          <ThemedText style={styles.loadEarlierText}>‹ Load earlier</ThemedText>
        </Pressable>
      }
      renderSectionHeader={({ section }) => {
        const isToday = section.title === todayIso;
        // ThemedView gives the sticky header an opaque background that
        // matches the theme so rows scrolling underneath don't bleed through.
        return (
          <ThemedView style={[styles.dayHeader, isToday && styles.dayHeaderToday]}>
            <ThemedText
              style={[styles.dayHeaderText, isToday && styles.dayHeaderTextToday]}>
              {formatDay(section.title)}
              {isToday ? '  ·  Today' : ''}
            </ThemedText>
          </ThemedView>
        );
      }}
      renderItem={({ item, section }) => {
        if (item.kind === 'empty-day') {
          return <ThemedText style={styles.empty}>No completions</ThemedText>;
        }
        return (
          <AgendaRow
            row={item}
            onPress={() => onRowPress(item, section.title)}
            onLongPress={() => onRowLongPress(item, section.title)}
          />
        );
      }}
      onEndReachedThreshold={0.4}
      onEndReached={onLoadMore}
      contentContainerStyle={styles.content}
    />
  );
}

function formatDay(iso: string): string {
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 100 },
  loadEarlier: {
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(127,127,127,0.2)',
    marginBottom: 4,
  },
  pressed: { opacity: 0.5 },
  loadEarlierText: { fontSize: 14, opacity: 0.6 },
  dayHeader: {
    paddingTop: 14,
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(127,127,127,0.18)',
  },
  dayHeaderToday: { borderBottomColor: 'rgba(124,58,237,0.6)' },
  dayHeaderText: { fontSize: 14, opacity: 0.7, fontWeight: '600' },
  dayHeaderTextToday: { color: '#7c3aed', opacity: 1 },
  empty: { fontSize: 13, opacity: 0.4, paddingVertical: 8, fontStyle: 'italic' },
});
