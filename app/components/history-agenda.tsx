import { useEffect, useMemo, useRef } from 'react';
import { RefreshControl, ScrollView, SectionList, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { AgendaRow as AgendaRowT, DayGroup } from '@/lib/history';

type SectionItem = AgendaRowT | { kind: 'empty-day' };

type Props = {
  groups: DayGroup[];
  scrollToIso: string | null;
  refreshing?: boolean;
  onRefresh?: () => void;
};

export function HistoryAgenda({ groups, scrollToIso, refreshing, onRefresh }: Props) {
  const ref = useRef<SectionList<SectionItem>>(null);
  const targetSectionRef = useRef<number | null>(null);
  const retriesRef = useRef(0);

  const sections = useMemo(
    () =>
      groups.map((g) => ({
        title: g.date,
        data: g.rows.length > 0 ? (g.rows as SectionItem[]) : [{ kind: 'empty-day' } as const],
      })),
    [groups],
  );

  useEffect(() => {
    if (!scrollToIso) {
      targetSectionRef.current = null;
      return;
    }
    const idx = sections.findIndex((s) => s.title === scrollToIso);
    if (idx < 0) return;
    targetSectionRef.current = idx;
    retriesRef.current = 0;
    // Defer to next tick so SectionList has measured.
    const t = setTimeout(() => {
      if (targetSectionRef.current !== idx) return;
      ref.current?.scrollToLocation({
        sectionIndex: idx,
        itemIndex: 0,
        viewPosition: 0,
        viewOffset: 0,
        animated: true,
      });
    }, 0);
    return () => clearTimeout(t);
  }, [scrollToIso, sections]);

  const monthIsEmpty =
    sections.length > 0 &&
    sections.every((s) => s.data.length === 1 && (s.data[0] as SectionItem).kind === 'empty-day');

  const refreshControl =
    onRefresh !== undefined ? (
      <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} />
    ) : undefined;

  if (monthIsEmpty) {
    return (
      <ScrollView
        contentContainerStyle={styles.emptyMonth}
        refreshControl={refreshControl}>
        <ThemedText style={styles.emptyMonthText}>
          No completions this month. Tap Today to mark a habit done.
        </ThemedText>
      </ScrollView>
    );
  }

  return (
    <SectionList
      ref={ref}
      refreshControl={refreshControl}
      sections={sections}
      stickySectionHeadersEnabled={false}
      keyExtractor={(item, idx) => {
        if (item.kind === 'completion') return item.id;
        if (item.kind === 'scheduled' || item.kind === 'skip')
          return `${idx}-${item.kind}-${item.habitId}`;
        return `${idx}-${item.kind}`;
      }}
      renderSectionHeader={({ section }) => (
        <ThemedText type="defaultSemiBold" style={styles.dayHeader}>
          {formatDayHeader(section.title)}
        </ThemedText>
      )}
      renderItem={({ item }) =>
        item.kind === 'empty-day' ? (
          <ThemedText style={styles.noCompletions}>No completions</ThemedText>
        ) : (
          <AgendaRow row={item} />
        )
      }
      onScrollToIndexFailed={() => {
        // SectionList's `info.index` is a flat index, not the sectionIndex —
        // use the value we stashed in the effect. Cap retries so we don't
        // loop forever if measurements never settle.
        const idx = targetSectionRef.current;
        if (idx === null || idx < 0 || idx >= sections.length) return;
        if (retriesRef.current >= 5) return;
        retriesRef.current += 1;
        setTimeout(() => {
          if (targetSectionRef.current !== idx) return;
          ref.current?.scrollToLocation({
            sectionIndex: idx,
            itemIndex: 0,
            viewPosition: 0,
            animated: true,
          });
        }, 120);
      }}
      contentContainerStyle={styles.scrollContent}
    />
  );
}

function AgendaRow({ row }: { row: AgendaRowT }) {
  const isSkip = row.kind === 'skip';
  const isScheduled = row.kind === 'scheduled';
  const marker = isSkip ? '—' : isScheduled ? '○' : '✓';
  return (
    <View style={styles.row}>
      <View
        style={[
          styles.swatch,
          row.habit.color ? { backgroundColor: row.habit.color } : styles.swatchFallback,
          (isSkip || isScheduled) && styles.swatchDim,
        ]}
      />
      <ThemedText
        style={[
          styles.marker,
          isSkip && styles.markerSkip,
          isScheduled && styles.markerScheduled,
        ]}>
        {marker}
      </ThemedText>
      <ThemedText
        style={[styles.title, isSkip && styles.skipText, isScheduled && styles.scheduledText]}
        numberOfLines={1}>
        {row.habit.icon ? `${row.habit.icon}  ` : ''}
        {row.habit.title}
      </ThemedText>
      {isSkip ? (
        <ThemedText style={styles.meta}>(skipped)</ThemedText>
      ) : row.time ? (
        <ThemedText style={[styles.meta, isScheduled && styles.metaScheduled]}>
          {row.time.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
        </ThemedText>
      ) : null}
    </View>
  );
}

function formatDayHeader(iso: string): string {
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 32 },
  dayHeader: {
    paddingTop: 16,
    paddingBottom: 6,
    fontSize: 14,
    opacity: 0.7,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(127,127,127,0.18)',
  },
  swatch: { width: 8, height: 24, borderRadius: 2 },
  swatchFallback: { backgroundColor: 'rgba(127,127,127,0.4)' },
  swatchDim: { opacity: 0.4 },
  marker: { fontSize: 16, width: 18, textAlign: 'center', opacity: 0.85 },
  markerSkip: { opacity: 0.5 },
  markerScheduled: { opacity: 0.55 },
  title: { flex: 1, fontSize: 16 },
  skipText: { opacity: 0.55, textDecorationLine: 'line-through' },
  scheduledText: { opacity: 0.75 },
  meta: { fontSize: 13, opacity: 0.55 },
  metaScheduled: { opacity: 0.45 },
  noCompletions: { fontSize: 14, opacity: 0.5, paddingVertical: 8, fontStyle: 'italic' },
  emptyMonth: {
    paddingVertical: 48,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  emptyMonthText: {
    textAlign: 'center',
    opacity: 0.6,
    fontSize: 15,
    lineHeight: 22,
  },
});
