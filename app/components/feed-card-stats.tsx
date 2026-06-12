// A small streak badge (🔥 N) shown on feed cards and the habit overview.
// Hidden when there's no active streak. Purely presentational — the streak is
// derived once per page in lib/feed.ts (feedItemStreak) / on the overview by
// lib/habit-stats.ts, never in render.
//
// An all-time completion count (# N) used to sit beside the streak here; it was
// removed as not visually important. The count still flows from the RPCs, so
// re-adding it is a UI-only change.

import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

// `inline` is kept for call-site symmetry; with a single metric the wrapper just
// controls right-alignment.
type Props = { streak: number; inline?: boolean };

export function FeedCardStats({ streak, inline = false }: Props) {
  if (streak <= 0) return null;

  return (
    <View style={[styles.container, inline && styles.inline]}>
      <ThemedText style={styles.streak}>🔥 {streak}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'flex-end', paddingRight: 4 },
  inline: { paddingRight: 0 },
  streak: { fontSize: 14, fontWeight: '700' },
});
