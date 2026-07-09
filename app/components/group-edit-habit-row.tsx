// One row in the identity editor's habit checklist: color dot, icon + title,
// an "Also in {identity}" hint when the habit serves other identities too
// (multi-identity is allowed), and a selection check. Presentational — the
// screen owns the selection state and the membership mutations.

import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTokens } from '@/hooks/use-tokens';
import type { GroupHabitChoice } from '@/lib/group-edit';

type Props = {
  choice: GroupHabitChoice;
  selected: boolean;
  onToggle: () => void;
};

export function GroupEditHabitRow({ choice, selected, onToggle }: Props) {
  const t = useTokens();
  return (
    <Pressable
      onPress={onToggle}
      style={[styles.row, { borderBottomColor: t.hairlineStrong }]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={choice.title}>
      <View style={[styles.dot, { backgroundColor: choice.color ?? t.ink45 }]} />
      <View style={styles.body}>
        <ThemedText style={styles.title} numberOfLines={1}>
          {choice.icon ? `${choice.icon}  ` : ''}
          {choice.title}
        </ThemedText>
        {choice.otherGroupName ? (
          <ThemedText style={styles.meta} numberOfLines={1}>
            Also in {choice.otherGroupName}
          </ThemedText>
        ) : null}
      </View>
      <View
        style={[
          styles.check,
          { borderColor: t.ink45 },
          selected && { backgroundColor: t.accent, borderColor: t.accent },
        ]}>
        {selected ? (
          <ThemedText style={[styles.checkMark, { color: t.onAccent }]}>✓</ThemedText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  body: { flex: 1 },
  title: { fontSize: 16 },
  meta: { fontSize: 13, opacity: 0.55, marginTop: 2 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { fontSize: 14, fontWeight: '700', lineHeight: 18 },
});
