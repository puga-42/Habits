// Presentational header for the group overview screen: the group's identity
// (icon + name + streak), a stat row (members / completions), the description,
// and the photo mosaic ("vision board") built from recent member-completion
// media. The screen owns all data (the Edit affordance lives in the screen's
// top bar, in line with Back).

import { Image } from 'expo-image';
import { Dimensions, StyleSheet, View } from 'react-native';

import { StreakBadge } from '@/components/streak-badge';
import { ThemedText } from '@/components/themed-text';

type Props = {
  name: string;
  color: string | null;
  icon: string | null;
  description: string | null;
  streak: number;
  memberCount: number;
  completions: number;
  photoUrls: string[];
};

export function GroupOverviewHeader({
  name,
  color,
  icon,
  description,
  streak,
  memberCount,
  completions,
  photoUrls,
}: Props) {
  const tint = color ?? 'rgba(127,127,127,0.6)';
  return (
    <View style={styles.root}>
      <View style={styles.identity}>
        <View style={[styles.iconCircle, { backgroundColor: tint }]}>
          <ThemedText style={styles.iconText}>{icon || '◎'}</ThemedText>
        </View>
        <View style={styles.titleWrap}>
          <ThemedText style={styles.name} numberOfLines={2}>
            {name}
          </ThemedText>
        </View>
        {streak > 0 ? <StreakBadge streak={streak} /> : null}
      </View>

      <View style={styles.stats}>
        <Stat value={memberCount} label={memberCount === 1 ? 'habit' : 'habits'} />
        <Stat value={completions} label="completions" />
        <Stat value={streak} label="day streak" />
      </View>

      {description ? (
        <ThemedText style={styles.description}>{description}</ThemedText>
      ) : null}

      {photoUrls.length > 0 ? (
        <View style={styles.mosaic}>
          {photoUrls.map((uri, i) => (
            <Image
              key={`${uri}-${i}`}
              source={{ uri }}
              style={[styles.tile, { width: TILE, height: TILE }]}
              contentFit="cover"
              transition={120}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <ThemedText style={styles.statValue}>{value}</ThemedText>
      <ThemedText style={styles.statLabel}>{label}</ThemedText>
    </View>
  );
}

const GAP = 6;
const COLS = 4;
const H_PADDING = 16;
// Square tile size so COLS tiles + (COLS-1) gaps exactly fill the padded row.
const TILE = Math.floor(
  (Dimensions.get('window').width - H_PADDING * 2 - GAP * (COLS - 1)) / COLS,
);

const styles = StyleSheet.create({
  root: { paddingHorizontal: 16, paddingTop: 8, gap: 16 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: 24 },
  titleWrap: { flex: 1 },
  name: { fontSize: 24, fontWeight: '700' },
  stats: { flexDirection: 'row', gap: 28 },
  stat: { alignItems: 'flex-start' },
  statValue: { fontSize: 22, fontWeight: '700' },
  statLabel: { fontSize: 12, opacity: 0.55, marginTop: 2 },
  description: { fontSize: 15, lineHeight: 21, opacity: 0.85 },
  mosaic: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  tile: {
    borderRadius: 10,
    backgroundColor: 'rgba(127,127,127,0.12)',
  },
});
