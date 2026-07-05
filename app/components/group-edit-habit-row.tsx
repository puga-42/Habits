// One row in the group editor's habit checklist: color dot, icon + title, an
// "In {other group}" hint when selecting would move the habit (one active
// group per habit), and a selection check. Presentational — the screen owns
// the selection state and the membership mutations.

import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { GroupHabitChoice } from '@/lib/group-edit';

type Props = {
  choice: GroupHabitChoice;
  selected: boolean;
  onToggle: () => void;
};

export function GroupEditHabitRow({ choice, selected, onToggle }: Props) {
  return (
    <Pressable
      onPress={onToggle}
      style={styles.row}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={choice.title}>
      <View
        style={[styles.dot, { backgroundColor: choice.color ?? 'rgba(127,127,127,0.5)' }]}
      />
      <View style={styles.body}>
        <ThemedText style={styles.title} numberOfLines={1}>
          {choice.icon ? `${choice.icon}  ` : ''}
          {choice.title}
        </ThemedText>
        {choice.otherGroupName && !selected ? (
          <ThemedText style={styles.meta} numberOfLines={1}>
            In {choice.otherGroupName}
          </ThemedText>
        ) : choice.otherGroupName && selected ? (
          <ThemedText style={styles.meta} numberOfLines={1}>
            Moves here from {choice.otherGroupName}
          </ThemedText>
        ) : null}
      </View>
      <View style={[styles.check, selected && styles.checkOn]}>
        {selected ? <ThemedText style={styles.checkMark}>✓</ThemedText> : null}
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
    borderBottomColor: 'rgba(127,127,127,0.2)',
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
    borderColor: 'rgba(127,127,127,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: '#0A84FF', borderColor: '#0A84FF' },
  checkMark: { color: '#fff', fontSize: 14, fontWeight: '700', lineHeight: 18 },
});
