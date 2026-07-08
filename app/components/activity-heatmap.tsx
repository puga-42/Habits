import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, useColorScheme, View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Palette } from '@/constants/colors';
import { useTokens } from '@/hooks/use-tokens';
import {
  buildHeatmapGrid, fetchActivityHeatmap, heatmapColor,
  type DayActivity, type HeatmapDay,
} from '@/lib/activity-heatmap';
import type { UserHabit } from '@/lib/user-profile';

const CELL = 12;
const GAP = 3;
const STEP = CELL + GAP;
const DAY_LABEL_WIDTH = 28;
const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''] as const;

type Props = {
  targetId: string;
  selectedLineageId: string | null;
  selectedDate: string | null;
  onSelectDate: (date: string | null, count: number) => void;
  habits: UserHabit[];
};

export function ActivityHeatmap({
  targetId, selectedLineageId, selectedDate, onSelectDate, habits,
}: Props) {
  const scheme = useColorScheme();
  const isDark = scheme !== 'light';
  const t = useTokens();
  const scrollRef = useRef<ScrollView>(null);
  const [days, setDays] = useState<DayActivity[]>([]);
  const [loading, setLoading] = useState(true);

  const { from, to } = useMemo(() => {
    const end = new Date();
    end.setDate(end.getDate() + 30);
    const start = new Date();
    start.setDate(end.getDate() - 363);
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { from: fmt(start), to: fmt(end) };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchActivityHeatmap(
      targetId, from, to,
      selectedLineageId ?? undefined,
    ).then((result) => {
      if (!cancelled) { setDays(result); setLoading(false); }
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [targetId, from, to, selectedLineageId]);

  const grid = useMemo(() => buildHeatmapGrid(from, to, days), [from, to, days]);

  const baseColor = useMemo(() => {
    if (!selectedLineageId) return t.accent;
    const habit = habits.find((h) => h.lineage_id === selectedLineageId);
    return habit?.color ?? Palette.habitColors[0];
  }, [selectedLineageId, habits, t.accent]);

  const handlePress = useCallback((day: HeatmapDay) => {
    const next = selectedDate === day.date ? null : day.date;
    onSelectDate(next, day.count);
  }, [selectedDate, onSelectDate]);

  const scrollToEnd = useCallback(() => {
    scrollRef.current?.scrollToEnd({ animated: false });
  }, []);

  if (loading && days.length === 0) {
    return <View style={s.loader}><ActivityIndicator size="small" /></View>;
  }

  return (
    <View style={s.root}>
      <View style={s.row}>
        <View style={s.dayLabels}>
          {DAY_LABELS.map((label, i) => (
            <View key={i} style={s.dayLabelCell}>
              {label ? <ThemedText style={s.dayLabelText}>{label}</ThemedText> : null}
            </View>
          ))}
        </View>
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          onContentSizeChange={scrollToEnd}
        >
          <View>
            <View style={s.monthRow}>
              {grid.monthLabels.map((ml) => (
                <ThemedText
                  key={`${ml.label}-${ml.weekIndex}`}
                  style={[s.monthLabel, { left: ml.weekIndex * STEP }]}
                >
                  {ml.label}
                </ThemedText>
              ))}
            </View>
            <View style={s.grid}>
              {grid.weeks.map((week, wi) => (
                <View key={wi} style={s.column}>
                  {week.map((day, di) => {
                    const isSelected = selectedDate === day.date;
                    return (
                      <Pressable
                        key={day.date}
                        onPress={() => handlePress(day)}
                        style={[
                          s.cell,
                          { backgroundColor: heatmapColor(baseColor, day.level, isDark) },
                          isSelected && s.cellSelected,
                        ]}
                      />
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { paddingHorizontal: 14, paddingVertical: 8 },
  loader: { height: 7 * STEP + 22, justifyContent: 'center', alignItems: 'center' },
  row: { flexDirection: 'row' },
  dayLabels: { width: DAY_LABEL_WIDTH, paddingTop: 22 },
  dayLabelCell: { height: STEP, justifyContent: 'center' },
  dayLabelText: { fontSize: 9, opacity: 0.5 },
  monthRow: { height: 18, marginBottom: 4, position: 'relative' },
  monthLabel: { position: 'absolute', fontSize: 9, opacity: 0.5, top: 2 },
  grid: { flexDirection: 'row', gap: GAP },
  column: { gap: GAP },
  cell: { width: CELL, height: CELL, borderRadius: 2 },
  cellSelected: {
    borderWidth: 1.5,
    borderColor: '#fff',
  },
});
