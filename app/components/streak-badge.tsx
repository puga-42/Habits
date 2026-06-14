// Streak badge for day-view habit pills: the streak count sits on top of a
// flame icon (StreakFlameIcon), placed just inside the trailing completion
// control. Purely presentational — the streak is computed once per load in
// lib/habit-stats.ts (streaksByHabit), never in render. Hidden when there's no
// active streak.

import { StyleSheet, Text, View } from 'react-native';

import { StreakFlameIcon } from '@/components/streak-flame-icon';

const SIZE = 30;

type Props = { streak: number };

export function StreakBadge({ streak }: Props) {
  if (streak <= 0) return null;

  return (
    <View style={styles.container}>
      <StreakFlameIcon size={SIZE} />
      {/* Bold white count nudged down into the flame's bulb, with a soft shadow
          so it stays legible over the brightest part of the gradient. */}
      <Text style={styles.count} allowFontScaling={false} numberOfLines={1}>
        {streak}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: {
    position: 'absolute',
    bottom: '-8%',
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 0.5 },
    textShadowRadius: 1.5,
  },
});
