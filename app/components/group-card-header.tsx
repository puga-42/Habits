// Header row of a day-view group card — the top cap of the card's surface
// (rounded top corners; day-content renders the matching group-footer cap).
// The WHOLE bar toggles collapse — the frequent action gets the big target —
// with a rotating carrot leading the name as the state indicator. Navigation
// to the group overview lives on a discrete trailing › detail-disclosure
// button. Collapse state is owned and persisted by the screen.

import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { StreakBadge } from '@/components/streak-badge';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Radii } from '@/constants/theme';
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
    <Pressable
      onPress={onToggle}
      style={[styles.header, { backgroundColor: t.surface }]}
      accessibilityRole="button"
      accessibilityState={{ expanded: !collapsed }}
      accessibilityLabel={`${collapsed ? 'Expand' : 'Collapse'} ${name}`}>
      {/* Rotating carrot: points right when collapsed, down when expanded. */}
      <IconSymbol
        name="chevron.right"
        size={14}
        weight="semibold"
        color={t.ink52}
        style={{ transform: [{ rotate: collapsed ? '0deg' : '90deg' }] }}
      />
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
      {/* Detail disclosure (ⓘ): the group's overview page — a different
          glyph class from the collapse carrot, so the two can't be confused. */}
      <Pressable
        onPress={() => router.push(`/group/${groupId}`)}
        hitSlop={12}
        style={styles.detail}
        accessibilityRole="button"
        accessibilityLabel={`Open ${name} overview`}>
        <IconSymbol name="info.circle" size={18} color={t.accent} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
    borderTopLeftRadius: Radii.card,
    borderTopRightRadius: Radii.card,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  title: { flex: 1, fontSize: 17 },
  streak: { marginRight: 2 },
  detail: { paddingLeft: 6, paddingVertical: 2 },
});
