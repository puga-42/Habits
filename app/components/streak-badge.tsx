// Compact streak badge (🔥 N) shown on day-view habit pills, just inside the
// trailing completion control. Purely presentational — the streak is computed
// once per load in lib/habit-stats.ts (streaksByHabit), never in render. Hidden
// when there's no active streak. Mirrors the feed/overview treatment
// (FeedCardStats) so the same number reads the same everywhere.

import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

type Props = { streak: number };

export function StreakBadge({ streak }: Props) {
  if (streak <= 0) return null;

  return (
    <View style={styles.container}>
      <ThemedText style={styles.icon}>🔥</ThemedText>
      <ThemedText style={styles.count}>{streak}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 16, lineHeight: 18 },
  count: { fontSize: 11, fontWeight: '700', lineHeight: 13, opacity: 0.85 },
});
