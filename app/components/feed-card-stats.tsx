// The right-hand stats column of a feed card: current streak and all-time
// completion count, right-aligned to sit under the card's overflow (•••) menu
// and top-aligned with the habit title. Streak is cadence-aware (lib/streak.ts)
// and computed here so FeedCard stays focused on layout.

import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { FeedItem } from '@/lib/feed';
import { computeStreak } from '@/lib/streak';

type Props = { item: FeedItem; now: Date };

export function FeedCardStats({ item, now }: Props) {
  // Memoized because the scheduled path expands the habit's RRULE.
  const streak = useMemo(
    () =>
      computeStreak(
        {
          kind: item.habit_kind,
          rrule: item.habit_rrule,
          dtstart: item.habit_dtstart,
          until: item.habit_until,
          target_count: item.flex_target,
          target_period: item.habit_target_period,
          completion_dates: item.completion_history,
          skip_dates: item.skip_history,
        },
        now,
      ),
    [
      item.habit_kind,
      item.habit_rrule,
      item.habit_dtstart,
      item.habit_until,
      item.flex_target,
      item.habit_target_period,
      item.completion_history,
      item.skip_history,
      now,
    ],
  );

  const count = item.completion_count;
  if (count === 0) return null;

  return (
    <View style={styles.container}>
      {streak > 0 ? (
        <ThemedText style={styles.streak}>🔥 {streak}</ThemedText>
      ) : null}
      <ThemedText style={styles.count}># {count}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  // paddingRight matches the overflow button's padding so the column lines up
  // under the ••• glyph.
  container: { alignItems: 'flex-end', paddingRight: 4, gap: 2 },
  streak: { fontSize: 14, fontWeight: '700' },
  count: { fontSize: 12, opacity: 0.55, fontWeight: '500' },
});
