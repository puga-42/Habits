// Header row for a day-view group card. Shows the group's name (and its current
// streak, if any). Tapping the name opens the group overview; the chevron pinned
// top-right collapses/expands the card. Collapse state is owned and persisted by
// the screen; navigation is handled here (router) to avoid threading a callback
// through CalendarDayView → DayContent.

import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { StreakBadge } from '@/components/streak-badge';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useTokens } from '@/hooks/use-tokens';

type Props = {
  groupId: string;
  name: string;
  collapsed: boolean;
  color?: string | null;
  streak?: number;
  onToggle: () => void;
};

export function GroupCardHeader({
  groupId,
  name,
  collapsed,
  color,
  streak,
  onToggle,
}: Props) {
  const router = useRouter();
  const t = useTokens();
  return (
    <View style={styles.header}>
      <Pressable
        onPress={() => router.push(`/group/${groupId}`)}
        style={styles.titleArea}
        accessibilityRole="button"
        accessibilityLabel={`Open ${name}`}>
        <View style={[styles.dot, { backgroundColor: color ?? t.ink45 }]} />
        {/* Group names speak in the Ember display voice (SF Pro Rounded). */}
        <ThemedText type="displaySemiBold" style={styles.title} numberOfLines={1}>
          {name}
        </ThemedText>
        {streak != null && streak > 0 ? (
          <View style={styles.streak}>
            <StreakBadge streak={streak} />
          </View>
        ) : null}
      </Pressable>
      {/* Chevron pinned top-right: points down when expanded, right when collapsed. */}
      <Pressable
        onPress={onToggle}
        hitSlop={10}
        style={styles.chevron}
        accessibilityRole="button"
        accessibilityState={{ expanded: !collapsed }}
        accessibilityLabel={`${collapsed ? 'Expand' : 'Collapse'} ${name}`}>
        <IconSymbol
          name="chevron.right"
          size={18}
          weight="semibold"
          color={t.ink52}
          style={{ transform: [{ rotate: collapsed ? '0deg' : '90deg' }] }}
        />
      </Pressable>
    </View>
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
  titleArea: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  title: { flex: 1, fontSize: 17 },
  streak: { marginRight: 2 },
  chevron: { paddingLeft: 4 },
});
