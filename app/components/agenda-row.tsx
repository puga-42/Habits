// Shared row for any agenda-style view (day, 3-day, week, schedule).
// Renders the habit as a pill-shaped card with:
//   - leading icon circle (filled with the habit's color)
//   - title and optional description
//   - trailing marker (○ / ✓ / —) or mini ring for flex habits
//
// Gestures on the pill:
//   - tap body      → no-op (completion moves to trailing press)
//   - long-press    → onLongPress (activate DraggableFlatList reorder)
//   - tap trailing  → onTrailingPress (mark complete / +1 flex)
//
// Views that don't support reorder simply omit onLongPress. Views with narrow
// horizontal space (3day columns) pass `compact` to drop the description and
// shrink the leading icon.

import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, useColorScheme, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { TimeTrailingIcon, type TimerStatus } from '@/components/time-trailing-icon';
import { solidTint } from '@/constants/colors';
import { TRAILING_ICON_SIZE } from '@/constants/theme';
import type { FlexPeriod } from '@/lib/habits';
import { useContentTransition } from '@/lib/use-content-transition';
import type { AgendaRow as AgendaRowT } from '@/lib/history';

const LONG_PRESS_MS = 300;
const FALLBACK_COLOR = '#5C5C6A';
const PILL_TINT = 0.22;

type Props = {
  row: AgendaRowT;
  onPress?: () => void;
  onTrailingPress?: () => void;
  onLongPress?: () => void;
  // Period progress for flex rows. When provided on a flex completion row,
  // the trailing area renders a quarter-step ring chart filled toward target.
  flexProgress?: { count: number; target: number };
  compact?: boolean | 'tight';
  // For time-based habits: the parent manages one global timer and passes
  // the status down so the trailing icon reflects start/stop state.
  timerStatus?: TimerStatus;
  timeProgress?: number;
  isActive?: boolean;
  hideTrailing?: boolean;
};

export function AgendaRow({
  row,
  onPress,
  onTrailingPress,
  onLongPress,
  flexProgress,
  compact = false,
  timerStatus,
  timeProgress,
  hideTrailing,
}: Props) {
  const isSkip = row.kind === 'skip';
  const isCompletion = row.kind === 'completion';
  const isFlex = row.kind === 'flex';
  const isFlexCompletion = isCompletion && row.isFlex;
  const isTight = compact === 'tight';

  const isDark = useColorScheme() !== 'light';
  const habitColor = row.habit.color ?? FALLBACK_COLOR;
  const pillBg = solidTint(row.habit.color ?? '#94A3B8', PILL_TINT, isDark);
  const iconSize = isTight ? 24 : compact ? 32 : 40;
  const emojiSize = isTight ? 14 : compact ? 18 : 22;

  // Subtitle text shown under the title for flex log-it rows: "2 / 3 this week".
  const flexSubtitle = isFlex ? formatFlexProgress(row.count, row.target, row.period) : null;

  const isTimeHabit = row.habit.unit === 'time';
  const trailingActionable =
    (row.kind === 'scheduled' || isFlex || isTimeHabit) && !!onTrailingPress;

  const handleTrailingPress = trailingActionable
    ? () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onTrailingPress!();
      }
    : undefined;

  const titleStyleKey = isCompletion ? 'done' : isSkip ? 'skip' : 'active';
  const titleTransition = useContentTransition(titleStyleKey);
  const trailingKey = hideTrailing ? 'hidden' : row.kind;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={LONG_PRESS_MS}
      style={({ pressed }) => [
        styles.pill,
        { backgroundColor: pillBg },
        compact && !isTight && styles.pillCompact,
        isTight && styles.pillTight,
        pressed && (onLongPress || onPress) && styles.pillPressed,
        isSkip && styles.pillSkipped,
        hideTrailing && styles.pillMuted,
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
        <Animated.View style={titleTransition}>
          <ThemedText
            style={[
              styles.title,
              isTight && styles.titleTight,
              isCompletion && !isFlexCompletion && styles.titleCompleted,
              isSkip && styles.titleSkipped,
            ]}
            numberOfLines={1}>
            {row.habit.title}
          </ThemedText>
        </Animated.View>
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

      {!isTight && (
        <Animated.View
          key={trailingKey}
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(400)}
        >
          {!hideTrailing && (
            <Pressable
              onPress={handleTrailingPress}
              hitSlop={{ top: 11, bottom: 11, left: 11, right: 11 }}
              accessibilityRole="button"
              accessibilityLabel={trailingA11yLabel(row)}
              accessibilityHint={trailingActionable ? trailingA11yHint(row) : undefined}
              style={({ pressed }) => [
                styles.trailing,
                pressed && trailingActionable && styles.trailingPressed,
                !trailingActionable && styles.trailingInert,
              ]}>
              {isTimeHabit && timerStatus ? (
                <TimeTrailingIcon status={timerStatus} color={habitColor} fraction={timeProgress} />
              ) : isFlex ? (
                <FlexRing count={row.count} target={row.target} color={habitColor} />
              ) : isFlexCompletion && flexProgress ? (
                <FlexRing count={flexProgress.count} target={flexProgress.target} color={habitColor} />
              ) : (
                <Marker kind={row.kind} color={habitColor} />
              )}
            </Pressable>
          )}
        </Animated.View>
      )}
    </Pressable>
  );
}

function trailingA11yLabel(row: AgendaRowT): string {
  if (row.kind === 'completion') return 'Completed';
  if (row.kind === 'skip') return 'Skipped';
  return `Complete ${row.habit.title}`;
}

function trailingA11yHint(row: AgendaRowT): string | undefined {
  if (row.kind === 'scheduled') return 'Marks this habit complete';
  if (row.kind === 'flex') return 'Adds one completion';
  return undefined;
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
  const opacity = useSharedValue(1);
  const prevCount = useRef(count);

  useEffect(() => {
    if (count !== prevCount.current) {
      prevCount.current = count;
      opacity.value = withSequence(
        withTiming(0.4, { duration: 120 }),
        withTiming(1, { duration: 180 }),
      );
    }
  }, [count, opacity]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={pulseStyle}>
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
    </Animated.View>
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
    backgroundColor: 'transparent',
  },
  pillCompact: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 8,
    borderRadius: 14,
  },
  pillTight: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 6,
    borderRadius: 10,
  },
  pillPressed: { opacity: 0.6 },
  pillSkipped: { opacity: 0.5 },
  pillMuted: { opacity: 0.5 },
  leading: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { textAlign: 'center' },
  body: { flex: 1 },
  title: { fontSize: 16, fontWeight: '600' },
  titleTight: { fontSize: 13 },
  titleCompleted: { opacity: 0.7 },
  titleSkipped: { textDecorationLine: 'line-through' },
  description: { fontSize: 13, opacity: 0.55, marginTop: 2 },
  descriptionSkipped: { textDecorationLine: 'line-through' },
  trailing: {
    width: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trailingPressed: { opacity: 0.6 },
  trailingInert: { opacity: 0.5 },
  markerDim: { fontSize: TRAILING_ICON_SIZE, opacity: 0.5 },
  markerCheck: { fontSize: TRAILING_ICON_SIZE, fontWeight: '700' },
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
