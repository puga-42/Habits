// Header row for a day-view group card. Shows the group's name (and its current
// streak, if any) with a collapse/expand chevron pinned to the top-right. Tapping
// anywhere on the row toggles the card; the chevron is the affordance. Purely
// presentational — collapse state is owned and persisted by the screen.

import { Pressable, StyleSheet, View } from 'react-native';

import { StreakBadge } from '@/components/streak-badge';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';

type Props = {
  name: string;
  collapsed: boolean;
  color?: string | null;
  streak?: number;
  onToggle: () => void;
};

export function GroupCardHeader({ name, collapsed, color, streak, onToggle }: Props) {
  return (
    <Pressable
      onPress={onToggle}
      style={styles.header}
      accessibilityRole="button"
      accessibilityState={{ expanded: !collapsed }}
      accessibilityLabel={`${collapsed ? 'Expand' : 'Collapse'} ${name}`}>
      <View style={[styles.dot, { backgroundColor: color ?? 'rgba(127,127,127,0.5)' }]} />
      <ThemedText style={styles.title} numberOfLines={1}>
        {name}
      </ThemedText>
      {streak != null && streak > 0 ? (
        <View style={styles.streak}>
          <StreakBadge streak={streak} />
        </View>
      ) : null}
      {/* Chevron pinned top-right: points down when expanded, right when collapsed. */}
      <IconSymbol
        name="chevron.right"
        size={18}
        weight="semibold"
        color="rgba(127,127,127,0.9)"
        style={{ transform: [{ rotate: collapsed ? '0deg' : '90deg' }] }}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 18,
    paddingBottom: 8,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  title: { flex: 1, fontSize: 17, fontWeight: '700' },
  streak: { marginRight: 2 },
});
