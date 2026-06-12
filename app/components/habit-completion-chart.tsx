import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, useColorScheme, View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Palette, solidTint } from '@/constants/colors';
import type { DayActivity } from '@/lib/activity-heatmap';
import {
  bucketByView, fetchHabitDowActivity, maxBarCount, yAxisTicks,
  CHART_VIEWS, type ChartView,
} from '@/lib/habit-completion-chart';
import type { Habit } from '@/lib/habits';

const CHART_HEIGHT = 120;
const BAR_GAP = 4;
const EMPTY_DARK = '#363647';
const EMPTY_LIGHT = '#E2E8F0';

type Props = { habit: Habit; viewerId: string };

export function HabitCompletionChart({ habit, viewerId }: Props) {
  const scheme = useColorScheme();
  const isDark = scheme !== 'light';
  const [days, setDays] = useState<DayActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ChartView>('weekly');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchHabitDowActivity(habit, viewerId)
      .then((result) => { if (!cancelled) { setDays(result); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [habit, viewerId]);

  const baseColor = habit.color ?? Palette.primary;
  const barColor = useMemo(() => solidTint(baseColor, 0.9, isDark), [baseColor, isDark]);
  const emptyColor = isDark ? EMPTY_DARK : EMPTY_LIGHT;

  const bars = useMemo(() => bucketByView(days, view), [days, view]);
  const ticks = useMemo(() => yAxisTicks(maxBarCount(bars)), [bars]);
  const axisMax = ticks[ticks.length - 1];
  const total = useMemo(() => bars.reduce((sum, b) => sum + b.count, 0), [bars]);
  const activeLabel = CHART_VIEWS.find((v) => v.key === view)?.label ?? '';
  // Keep weekday/month compact; scroll the dense day/week views.
  const scrolls = view === 'monthly' || view === 'weeks_year';
  const barWidth = view === 'weekly' ? 26 : view === 'month' ? 18 : 14;

  return (
    <View style={s.root}>
      <View style={s.header}>
        <View style={s.headerLeft}>
          <ThemedText style={s.title}>Completions</ThemedText>
          <ThemedText style={s.total}>{total}</ThemedText>
        </View>
        <Pressable style={s.dropdown} onPress={() => setMenuOpen(true)} hitSlop={6}>
          <ThemedText style={s.dropdownText}>{activeLabel}</ThemedText>
          <ThemedText style={s.chevron}>▾</ThemedText>
        </Pressable>
      </View>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setMenuOpen(false)}>
          <ThemedView style={s.menu}>
            {CHART_VIEWS.map((v) => {
              const active = v.key === view;
              return (
                <Pressable
                  key={v.key}
                  style={s.menuRow}
                  onPress={() => { setView(v.key); setMenuOpen(false); }}
                >
                  <ThemedText style={[s.menuText, active && s.menuTextActive]}>
                    {v.label}
                  </ThemedText>
                  {active ? <ThemedText style={[s.check, { color: barColor }]}>✓</ThemedText> : null}
                </Pressable>
              );
            })}
          </ThemedView>
        </Pressable>
      </Modal>

      {loading && days.length === 0 ? (
        <View style={s.loader}><ActivityIndicator size="small" /></View>
      ) : total === 0 ? (
        <View style={s.loader}>
          <ThemedText style={s.empty}>No completions yet.</ThemedText>
        </View>
      ) : (
        <View style={s.chartRow}>
          <View style={s.yAxis}>
            {ticks.map((t) => (
              <ThemedText
                key={t}
                style={[s.yLabel, { bottom: (t / axisMax) * CHART_HEIGHT - 7 }]}
                numberOfLines={1}
              >
                {t}
              </ThemedText>
            ))}
          </View>

          <View style={s.plot}>
            <View style={s.gridArea} pointerEvents="none">
              {ticks.map((t) => (
                <View key={t} style={[s.gridline, { bottom: (t / axisMax) * CHART_HEIGHT }]} />
              ))}
            </View>

            <ScrollView
              horizontal={scrolls}
              showsHorizontalScrollIndicator={false}
              scrollEnabled={scrolls}
              contentContainerStyle={scrolls ? undefined : s.fill}
            >
              <View style={[s.bars, scrolls && s.barsScroll]}>
                {bars.map((bar) => (
                  <View key={bar.key} style={[s.barCol, { width: barWidth }]}>
                    <View style={s.barTrack}>
                      <View
                        style={[
                          s.bar,
                          {
                            height: Math.max(2, (bar.count / axisMax) * CHART_HEIGHT),
                            backgroundColor: bar.count > 0 ? barColor : emptyColor,
                          },
                        ]}
                      />
                    </View>
                    <ThemedText style={s.barLabel} numberOfLines={1}>{bar.label}</ThemedText>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    marginTop: 8,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(127,127,127,0.2)',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  headerLeft: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  title: { fontSize: 15, fontWeight: '600' },
  total: { fontSize: 15, fontWeight: '600', opacity: 0.5 },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(127,127,127,0.12)',
  },
  dropdownText: { fontSize: 13, fontWeight: '600' },
  chevron: { fontSize: 10, opacity: 0.6 },
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.35)' },
  menu: {
    minWidth: 180,
    borderRadius: 14,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.25)',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  menuText: { fontSize: 15 },
  menuTextActive: { fontWeight: '600' },
  check: { fontSize: 14, fontWeight: '700' },
  loader: { height: CHART_HEIGHT + 24, justifyContent: 'center', alignItems: 'center' },
  empty: { fontSize: 13, opacity: 0.5 },
  chartRow: { flexDirection: 'row' },
  yAxis: { width: 22, height: CHART_HEIGHT, marginRight: 6 },
  yLabel: {
    position: 'absolute',
    right: 0,
    width: 22,
    textAlign: 'right',
    fontSize: 9,
    opacity: 0.5,
  },
  plot: { flex: 1, position: 'relative' },
  gridArea: { position: 'absolute', left: 0, right: 0, top: 0, height: CHART_HEIGHT },
  gridline: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(127,127,127,0.18)',
  },
  fill: { flexGrow: 1 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', flex: 1 },
  barsScroll: { gap: BAR_GAP, justifyContent: 'flex-start', flex: 0 },
  barCol: { alignItems: 'center' },
  barTrack: { height: CHART_HEIGHT, justifyContent: 'flex-end', width: '100%' },
  bar: { width: '78%', alignSelf: 'center', borderRadius: 3, minHeight: 2 },
  barLabel: { fontSize: 9, opacity: 0.5, marginTop: 5 },
});
