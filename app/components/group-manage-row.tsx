// One row in the Groups management screen: color dot, name (tap to rename
// inline), active-habit count, and a Delete affordance. Presentational — the
// screen owns the data and the create/rename/delete mutations.

import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTokens } from '@/hooks/use-tokens';

type Props = {
  name: string;
  color: string | null;
  count: number;
  editing: boolean;
  editName: string;
  textColor: string;
  onChangeEditName: (s: string) => void;
  onStartEdit: () => void;
  onCommitEdit: () => void;
  onDelete: () => void;
  onOpen: () => void;
};

export function GroupManageRow({
  name,
  color,
  count,
  editing,
  editName,
  textColor,
  onChangeEditName,
  onStartEdit,
  onCommitEdit,
  onDelete,
  onOpen,
}: Props) {
  const t = useTokens();
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: color ?? t.ink45 }]} />
      {editing ? (
        <TextInput
          value={editName}
          onChangeText={onChangeEditName}
          autoFocus
          onBlur={onCommitEdit}
          onSubmitEditing={onCommitEdit}
          style={[styles.name, styles.nameInput, { color: textColor }]}
          maxLength={100}
        />
      ) : (
        <Pressable style={styles.nameWrap} onPress={onStartEdit}>
          <ThemedText style={styles.name} numberOfLines={1}>
            {name}
          </ThemedText>
          <ThemedText style={styles.count}>
            {count} habit{count === 1 ? '' : 's'}
          </ThemedText>
        </Pressable>
      )}
      <Pressable onPress={onDelete} hitSlop={10}>
        <ThemedText style={[styles.delete, { color: t.danger }]}>Delete</ThemedText>
      </Pressable>
      <Pressable
        onPress={onOpen}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={`Open ${name}`}>
        <ThemedText style={styles.open}>›</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  nameWrap: { flex: 1 },
  name: { fontSize: 16 },
  nameInput: { flex: 1, padding: 0 },
  count: { fontSize: 13, opacity: 0.5, marginTop: 2 },
  delete: { fontSize: 15 },
  open: { fontSize: 22, opacity: 0.3, paddingLeft: 2 },
});
