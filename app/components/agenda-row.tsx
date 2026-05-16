// Shared row for any agenda-style view (day, 3-day, week, schedule).
// Renders the habit as a pill-shaped card with:
//   - leading icon circle (filled with the habit's color)
//   - title and optional description
//   - trailing marker (○ / ✓ / —) or mini ring for flex habits
//
// Two gestures on the pill itself:
//   - tap        → onPress (typically: mark complete / un-complete)
//   - long-press → onLongPress (typically: activate DraggableFlatList reorder)
//
// Views that don't support reorder simply omit onLongPress. Views with narrow
// horizontal space (3day columns) pass `compact` to drop the description and
// shrink the leading icon.

import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { FlexPeriod } from '@/lib/habits';
import type { AgendaRow as AgendaRowT } from '@/lib/history';

const LONG_PRESS_MS = 300;
const FALLBACK_COLOR = 'rgba(127,127,127,0.45)';

type Props = {
  row: AgendaRowT;
  onPress?: () => void;
  onLongPress?: () => void;
  // Period progress for flex rows. When provided on a flex completion row,
  // the trailing area renders a quarter-step ring chart filled toward target.
  flexProgress?: { count: number; target: number };
  // Compact mode for narrow surfaces. Hides description, shrinks the leading
  // icon, and reduces pill padding.
  compact?: boolean;
  // Accepted for API compatibility with DraggableFlatList's RenderItemParams;
  // the row's appearance never changes — finger on the moving row is enough
  // visual feedback.
  isActive?: boolean;
};

export function AgendaRow({
  row,
  onPress,
  onLongPress,
  flexProgress,
  compact = false,
}: Props) {
  const isSkip = row.kind === 'skip';
  const isCompletion = row.kind === 'completion';
  const isFlex = row.kind === 'flex';
  const isFlexCompletion = isCompletion && row.isFlex;

  const habitColor = row.habit.color ?? FALLBACK_COLOR;
  const iconSize = compact ? 32 : 40;
  const emojiSize = compact ? 18 : 22;

  // Subtitle text shown under the title for flex log-it rows: "2 / 3 this week".
  const flexSubtitle = isFlex ? formatFlexProgress(row.count, row.target, row.period) : null;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={LONG_PRESS_MS}
      style={({ pressed }) => [
        styles.pill,
        compact && styles.pillCompact,
        pressed && styles.pillPressed,
        isSkip && styles.pillSkipped,
      ]}>
      <View
        style={[
          styles.leading,
          { width: iconSize, height: iconSize, borderRadius: iconSize / 2 },
          { backgroundColor: habitColor },
        ]}>
        {row.habit.icon ? (
          <ThemedText style={[styles.emoji, { fontSize: emojiSize }]}>
            {row.habit.icon}
          </ThemedText>
        ) : null}
      </View>

      <View style={styles.body}>
        <ThemedText
          style={[
            styles.title,
            isCompletion && !isFlexCompletion && styles.titleCompleted,
            isSkip && styles.titleSkipped,
          ]}
          numberOfLines={1}>
          {row.habit.title}
        </ThemedText>
        {!compact && flexSubtitle ? (
          <ThemedText style={styles.description} numberOfLines={1}>
            {flexSubtitle}
          </ThemedText>
        ) : !compact && row.habit.description ? (
          <ThemedText
            style={[styles.description, isSkip && styles.descriptionSkipped]}
            numberOfLines={1}>
            {row.habit.description}
          </ThemedText>
        ) : null}
      </View>

      <View style={styles.trailing}>
        {isFlex ? (
          <FlexRing count={row.count} target={row.target} color={habitColor} />
        ) : isFlexCompletion && flexProgress ? (
          <FlexRing count={flexProgress.count} target={flexProgress.target} color={habitColor} />
        ) : (
          <Marker kind={row.kind} color={habitColor} />
        )}
      </View>
    </Pressable>
  );
}

function formatFlexProgress(count: number, target: number, period: FlexPeriod): string {
  const suffix = period === 'day' ? 'today' : period === 'week' ? 'this week' : 'this month';
  return `${count} / ${target} ${suffix}`;
}

function Marker({
  kind,
  color,
}: {
  kind: AgendaRowT['kind'];
  color: string;
}) {
  if (kind === 'completion') {
    return <ThemedText style={[styles.markerCheck, { color }]}>✓</ThemedText>;
  }
  if (kind === 'skip') {
    return <ThemedText style={styles.markerDim}>—</ThemedText>;
  }
  // scheduled
  return <ThemedText style={styles.markerDim}>○</ThemedText>;
}

// A quarter-stepped ring rendered via four border-color sides on a circular
// View. Each "quarter" of the ring lights up once progress crosses 0.25,
// 0.50, 0.75, and 1.0 respectively. Coarser than a true arc but uses pure
// React Native (no SVG dep) and is legible at 18pt.
function FlexRing({
  count,
  target,
  color,
}: {
  count: number;
  target: number;
  color: string;
}) {
  const pct = target > 0 ? Math.min(count / target, 1) : 0;
  const track = 'rgba(127,127,127,0.25)';

  return (
    <View
      style={[
        styles.ring,
        {
          borderTopColor: pct >= 0.25 ? color : track,
          borderRightColor: pct >= 0.5 ? color : track,
          borderBottomColor: pct >= 0.75 ? color : track,
          borderLeftColor: pct >= 1 ? color : track,
        },
      ]}>
      {pct >= 1 ? (
        <ThemedText style={[styles.ringCheck, { color }]}>✓</ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(127,127,127,0.08)',
  },
  pillCompact: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 8,
    borderRadius: 14,
  },
  pillPressed: { opacity: 0.6 },
  pillSkipped: { opacity: 0.5 },
  leading: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { textAlign: 'center' },
  body: { flex: 1 },
  title: { fontSize: 16, fontWeight: '600' },
  titleCompleted: { opacity: 0.7 },
  titleSkipped: { textDecorationLine: 'line-through' },
  description: { fontSize: 13, opacity: 0.55, marginTop: 2 },
  descriptionSkipped: { textDecorationLine: 'line-through' },
  trailing: {
    width: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerDim: { fontSize: 18, opacity: 0.5 },
  markerCheck: { fontSize: 18, fontWeight: '700' },
  ring: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCheck: { fontSize: 10, fontWeight: '700', lineHeight: 12 },
});
