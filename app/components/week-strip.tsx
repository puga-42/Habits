// Week strip: 7 day cells for the week containing `anchorDate`, with a
// 3-page horizontal pager so swiping the strip jumps anchor ±7 days (same
// weekday). Each cell's background fill scales with that day's completion
// density. The selected day is outlined; today is accent-colored when it's
// not the selected day.

import { useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, useColorScheme, View } from 'react-native';
import PagerView from 'react-native-pager-view';

import { ThemedText } from '@/components/themed-text';
import { Palette, solidTint } from '@/constants/colors';
import { isoDate } from '@/lib/habits';
import { densityBucket, weekDatesFrom } from '@/lib/history';

const ACCENT = Palette.primary;
const TODAY_ACCENT = Palette.lavender;
const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DENSITY_ALPHA = [0, 0.12, 0.26, 0.45, 0.68] as const;

type Props = {
  anchorDate: Date;
  weekStart: number;
  today: Date;
  countByDate: Map<string, number>;
  onSelect: (date: Date) => void;
};

export function WeekStrip({
  anchorDate,
  weekStart,
  today,
  countByDate,
  onSelect,
}: Props) {
  const pagerRef = useRef<PagerView>(null);

  // Three week-start dates: prev / current / next. The "current" week is the
  // one containing the anchor.
  const weekStarts = useMemo(() => {
    const out: Date[] = [];
    for (let offset = -1; offset <= 1; offset++) {
      const a = new Date(anchorDate);
      a.setDate(a.getDate() + offset * 7);
      out.push(a);
    }
    return out;
  }, [anchorDate]);

  // After anchorDate changes, re-center the pager on the middle page without
  // animation so the next swipe starts from a clean ±1 step.
  useEffect(() => {
    pagerRef.current?.setPageWithoutAnimation(1);
  }, [anchorDate]);

  const anchorIso = isoDate(anchorDate);
  const todayIso = isoDate(today);

  return (
    <PagerView
      ref={pagerRef}
      initialPage={1}
      style={styles.pager}
      onPageSelected={(e) => {
        const idx = e.nativeEvent.position;
        if (idx === 1) return;
        const delta = (idx - 1) * 7;
        const next = new Date(anchorDate);
        next.setDate(next.getDate() + delta);
        onSelect(next);
      }}>
      {weekStarts.map((weekAnchor, pageIdx) => (
        <View key={pageIdx} style={styles.page} collapsable={false}>
          <WeekRow
            weekAnchor={weekAnchor}
            weekStart={weekStart}
            anchorIso={anchorIso}
            todayIso={todayIso}
            countByDate={countByDate}
            onSelect={onSelect}
          />
        </View>
      ))}
    </PagerView>
  );
}

function WeekRow({
  weekAnchor,
  weekStart,
  anchorIso,
  todayIso,
  countByDate,
  onSelect,
}: {
  weekAnchor: Date;
  weekStart: number;
  anchorIso: string;
  todayIso: string;
  countByDate: Map<string, number>;
  onSelect: (date: Date) => void;
}) {
  const dates = useMemo(
    () => weekDatesFrom(weekAnchor, weekStart),
    [weekAnchor, weekStart],
  );

  const isDark = useColorScheme() !== 'light';

  return (
    <View style={styles.row}>
      {dates.map((iso, i) => {
        const letter = WEEKDAY_LETTERS[(weekStart + i) % 7];
        const day = parseInt(iso.slice(8, 10), 10);
        const count = countByDate.get(iso) ?? 0;
        const bucket = densityBucket(count);
        const isSelected = iso === anchorIso;
        const isToday = iso === todayIso;

        return (
          <Pressable
            key={iso}
            hitSlop={4}
            onPress={() => onSelect(parseIsoLocal(iso))}
            style={({ pressed }) => [styles.cellWrap, pressed && styles.cellPressed]}>
            <ThemedText
              style={[
                styles.weekdayLetter,
                isToday && !isSelected && styles.todayText,
              ]}>
              {letter}
            </ThemedText>
            <View
              style={[
                styles.dayBubble,
                bucket > 0 && {
                  backgroundColor: solidTint(ACCENT, DENSITY_ALPHA[bucket], isDark),
                },
                isSelected && styles.dayBubbleSelected,
              ]}>
              <ThemedText
                style={[
                  styles.dayNumber,
                  isToday && !isSelected && styles.todayText,
                  isSelected && styles.dayNumberSelected,
                ]}>
                {day}
              </ThemedText>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function parseIsoLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

const CELL_BUBBLE = 34;

const styles = StyleSheet.create({
  pager: { height: 64 },
  page: { flex: 1, justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    paddingHorizontal: 8,
  },
  cellWrap: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  cellPressed: { opacity: 0.6 },
  weekdayLetter: {
    fontSize: 11,
    opacity: 0.55,
    fontWeight: '600',
    marginBottom: 2,
  },
  dayBubble: {
    width: CELL_BUBBLE,
    height: CELL_BUBBLE,
    borderRadius: CELL_BUBBLE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBubbleSelected: {
    borderWidth: 1.5,
    borderColor: ACCENT,
  },
  dayNumber: { fontSize: 15, fontWeight: '500' },
  dayNumberSelected: { fontWeight: '700' },
  todayText: { color: TODAY_ACCENT },
});
