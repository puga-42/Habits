import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { densityBucket, type MonthCell } from '@/lib/history';

type Props = {
  cells: MonthCell[];
  countByDate: Map<string, number>;
  selectedIso: string | null;
  onSelectDay: (iso: string) => void;
};

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// Single density accent (matches the app's default habit color). The plan
// originally said "theme tint" but the dark-mode tint is white, which would
// be unreadable at high opacity. A saturated purple reads on both themes.
const DENSITY_HEX = '#7c3aed';

const BUCKET_ALPHA: Record<0 | 1 | 2 | 3 | 4, number> = {
  0: 0,
  1: 0.2,
  2: 0.4,
  3: 0.65,
  4: 0.9,
};

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const TODAY_RING = hexToRgba(DENSITY_HEX, 0.55);
const SELECTED_RING = DENSITY_HEX;

export function HistoryCalendar({ cells, countByDate, selectedIso, onSelectDay }: Props) {
  // Chunk into rows of 7 (avoids the sub-pixel flexWrap overflow bug).
  const weeks = useMemo(() => {
    const out: MonthCell[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      out.push(cells.slice(i, i + 7));
    }
    return out;
  }, [cells]);

  return (
    <View style={styles.root}>
      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((d, i) => (
          <ThemedText key={i} style={styles.weekday}>
            {d}
          </ThemedText>
        ))}
      </View>
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.weekRow}>
          {week.map((cell) => {
            const isSelected = selectedIso === cell.iso;
            const count = countByDate.get(cell.iso) ?? 0;
            const eligibleForFill = cell.inMonth && !cell.isFuture;
            const bucket = eligibleForFill ? densityBucket(count) : 0;
            const fillAlpha = BUCKET_ALPHA[bucket];
            const fillColor = fillAlpha > 0 ? hexToRgba(DENSITY_HEX, fillAlpha) : 'transparent';
            const highDensity = bucket >= 3;

            return (
              <Pressable
                key={cell.iso}
                onPress={() => onSelectDay(cell.iso)}
                style={({ pressed }) => [
                  styles.cell,
                  { backgroundColor: fillColor },
                  cell.isToday && !isSelected && { borderColor: TODAY_RING },
                  isSelected && {
                    borderColor: SELECTED_RING,
                    borderWidth: 2.5,
                  },
                  pressed && styles.cellPressed,
                ]}>
                <ThemedText
                  style={[
                    styles.cellDay,
                    !cell.inMonth && styles.cellDayOutside,
                    cell.isFuture && cell.inMonth && styles.cellDayFuture,
                    cell.isToday && styles.cellDayEmphasis,
                    highDensity && styles.cellDayOnFill,
                  ]}>
                  {cell.date.getDate()}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 4 },
  weekdayRow: { flexDirection: 'row' },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    opacity: 0.5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  weekRow: { flexDirection: 'row' },
  cell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    // Constant border on every cell so the today/selected rings don't shift
    // content sub-pixel.
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  cellPressed: { opacity: 0.5 },
  cellDay: { fontSize: 15, opacity: 0.85 },
  cellDayOutside: { opacity: 0.25 },
  cellDayFuture: { opacity: 0.45 },
  cellDayEmphasis: { fontWeight: '600', opacity: 1 },
  // White text on the darker density fills, where the dim default text would
  // disappear.
  cellDayOnFill: { color: '#fff', opacity: 1, fontWeight: '600' },
});
