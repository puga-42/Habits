// "Group" disclosure row for the habit form. Lets the user file a habit under an
// identity group (Atomic Habits) or leave it ungrouped, and create a new group
// inline. Writes the chosen group id to the shared draft (draft.groupId); the
// create/edit screen reconciles that into a membership write on save.

import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTokens } from '@/hooks/use-tokens';
import { useAuth } from '@/lib/auth';
import { createGroup } from '@/lib/group-mutations';
import { fetchGroups, type HabitGroup } from '@/lib/groups';
import { useHabitForm } from '@/lib/habit-form';

export function GroupPickerRow() {
  const { draft, update } = useHabitForm();
  const { session } = useAuth();
  const userId = session?.user.id;
  const t = useTokens();

  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<HabitGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open || !userId) return;
    setLoading(true);
    fetchGroups(userId)
      .then(setGroups)
      .catch(() => setGroups([]))
      .finally(() => setLoading(false));
  }, [open, userId]);

  const selected = groups.find((g) => g.id === draft.groupId);
  const summary = selected?.name ?? (draft.groupId ? 'Group' : 'None');

  async function onCreate() {
    const name = newName.trim();
    if (!name || !userId || creating) return;
    setCreating(true);
    try {
      const id = await createGroup(userId, { name });
      const next = await fetchGroups(userId);
      setGroups(next);
      update({ groupId: id });
      setNewName('');
    } finally {
      setCreating(false);
    }
  }

  return (
    <View>
      <Pressable style={styles.row} onPress={() => setOpen((s) => !s)}>
        <ThemedText style={styles.rowLabel}>Group</ThemedText>
        <View style={styles.rowRight}>
          <ThemedText style={styles.value} numberOfLines={1}>
            {summary}
          </ThemedText>
          <ThemedText style={styles.chevron}>›</ThemedText>
        </View>
      </Pressable>

      {open && (
        <View style={styles.list}>
          {loading ? (
            <ActivityIndicator style={styles.loading} />
          ) : (
            <>
              <Option
                label="None"
                selected={draft.groupId == null}
                onPress={() => update({ groupId: null })}
              />
              {groups.map((g) => (
                <Option
                  key={g.id}
                  label={g.name}
                  selected={draft.groupId === g.id}
                  onPress={() => update({ groupId: g.id })}
                />
              ))}
            </>
          )}
          <View style={styles.createRow}>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="New group…"
              placeholderTextColor={t.ink45}
              style={[styles.createInput, { color: t.ink }]}
              returnKeyType="done"
              onSubmitEditing={onCreate}
              maxLength={100}
            />
            <Pressable
              onPress={onCreate}
              disabled={!newName.trim() || creating}
              hitSlop={8}>
              <ThemedText
                style={[
                  styles.add,
                  { color: t.accent },
                  (!newName.trim() || creating) && styles.addDisabled,
                ]}>
                Add
              </ThemedText>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

function Option({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={styles.option}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}>
      <ThemedText style={styles.optionLabel} numberOfLines={1}>
        {label}
      </ThemedText>
      {selected ? <ThemedText style={styles.check}>✓</ThemedText> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowLabel: { fontSize: 16 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  value: { fontSize: 16, opacity: 0.55, maxWidth: 180 },
  chevron: { fontSize: 22, opacity: 0.4 },
  list: { paddingBottom: 8 },
  loading: { paddingVertical: 12 },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  optionLabel: { fontSize: 15, flexShrink: 1 },
  check: { fontSize: 16, color: '#34C759', fontWeight: '700' },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  createInput: { flex: 1, fontSize: 15, padding: 0 },
  add: { fontSize: 15, fontWeight: '600' },
  addDisabled: { opacity: 0.4 },
});
