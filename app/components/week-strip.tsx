import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Palette, solidTint } from '@/constants/colors';
import { isoDate } from '@/lib/habits';
import { densityBucket } from '@/lib/history';

const ACCENT = Palette.primary;
const TODAY_ACCENT = Palette.lavender;
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DENSITY_ALPHA = [0, 0.12, 0.26, 0.45, 0.68] as const;

const HALF_WINDOW = 90;
const CELL_BUBBLE = 30;
const OVAL_HEIGHT = 66;
const OVAL_WIDTH = 40;

type Props = {
  anchorDate: Date;
  weekStart: number;
  today: Date;
  countByDate: Map<string, number>;
  onSelect: (date: Date) => void;
};

function buildDateStrip(today: Date): string[] {
  const dates: string[] = [];
  const start = new Date(today);
  start.setDate(start.getDate() - HALF_WINDOW);
  for (let i = 0; i <= HALF_WINDOW * 2; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(isoDate(d));
  }
  return dates;
}

export function WeekStrip({
  anchorDate,
  today,
  countByDate,
  onSelect,
}: Props) {
  const anchorIso = isoDate(anchorDate);
  const todayIso = isoDate(today);
  const isDark = useColorScheme() !== 'light';
  const listRef = useRef<FlatList<string>>(null);
  const { width: screenWidth } = useWindowDimensions();
  const cellWidth = Math.floor(screenWidth / 7);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const dates = useMemo(() => buildDateStrip(today), [todayIso]);

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: cellWidth,
      offset: cellWidth * index,
      index,
    }),
    [cellWidth],
  );

  const initialIndex = useMemo(() => {
    const idx = dates.indexOf(anchorIso);
    return idx >= 0 ? idx : HALF_WINDOW;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const idx = dates.indexOf(anchorIso);
    if (idx >= 0) {
      listRef.current?.scrollToIndex({
        index: idx,
        animated: true,
        viewPosition: 0.5,
      });
    }
  }, [anchorIso, dates]);

  const handleScrollFailed = useCallback(
    (info: { index: number }) => {
      setTimeout(() => {
        listRef.current?.scrollToIndex({
          index: info.index,
          animated: true,
          viewPosition: 0.5,
        });
      }, 100);
    },
    [],
  );

  const renderItem = useCallback(
    ({ item: iso }: { item: string }) => {
      const date = parseIsoLocal(iso);
      const letter = WEEKDAY_LABELS[date.getDay()];
      const day = date.getDate();
      const count = countByDate.get(iso) ?? 0;
      const bucket = densityBucket(count);
      const isSelected = iso === anchorIso;
      const isToday = iso === todayIso;
      // Both the selected day and today get a solid fill; today (lavender) wins
      // when it is also the selected day.
      const filled = isSelected || isToday;

      return (
        <Pressable
          hitSlop={4}
          onPress={() => onSelect(parseIsoLocal(iso))}
          style={({ pressed }) => [
            styles.cellWrap,
            { width: cellWidth },
            pressed && styles.cellPressed,
          ]}>
          <View
            style={[
              styles.cellInner,
              isSelected && !isToday && styles.cellSelected,
              isToday && styles.cellToday,
            ]}>
            <ThemedText
              style={[
                styles.weekdayLetter,
                filled && styles.filledText,
              ]}>
              {letter}
            </ThemedText>
            <View
              style={[
                styles.dayBubble,
                bucket > 0 && !filled && {
                  backgroundColor: solidTint(
                    ACCENT,
                    DENSITY_ALPHA[bucket],
                    isDark,
                  ),
                },
              ]}>
              <ThemedText
                style={[
                  styles.dayNumber,
                  filled && styles.selectedText,
                  filled && styles.filledText,
                ]}>
                {day}
              </ThemedText>
            </View>
          </View>
        </Pressable>
      );
    },
    [anchorIso, todayIso, countByDate, isDark, onSelect, cellWidth],
  );

  const keyExtractor = useCallback((iso: string) => iso, []);

  return (
    <View style={styles.strip}>
      <FlatList
        ref={listRef}
        data={dates}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        initialScrollIndex={initialIndex}
        onScrollToIndexFailed={handleScrollFailed}
        windowSize={5}
      />
    </View>
  );
}

function parseIsoLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

const styles = StyleSheet.create({
  strip: { height: 70, justifyContent: 'center' },
  cellWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellInner: {
    width: OVAL_WIDTH,
    height: OVAL_HEIGHT,
    borderRadius: OVAL_WIDTH / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellToday: {
    backgroundColor: TODAY_ACCENT,
  },
  cellSelected: {
    backgroundColor: ACCENT,
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
  dayNumber: { fontSize: 15, fontWeight: '500' },
  selectedText: { fontWeight: '700' },
  filledText: { color: '#fff', opacity: 1 },
});
