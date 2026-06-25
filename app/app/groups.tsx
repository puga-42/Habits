// Groups management — create, rename, and delete identity groups. Reached from
// the FAB ("New group") and the menu drawer ("Manage groups"). Deleting a group
// ungroups its habits (membership cascade); the habits themselves are untouched.

import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GroupManageRow } from '@/components/group-manage-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/lib/auth';
import { createGroup, deleteGroup, renameGroup } from '@/lib/group-mutations';
import { fetchGroups, fetchMemberships, type HabitGroup } from '@/lib/groups';

export default function GroupsScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;
  const textColor = useThemeColor({}, 'text');

  const [groups, setGroups] = useState<HabitGroup[]>([]);
  const [memberCount, setMemberCount] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const load = useCallback(async () => {
    if (!userId) return;
    const [gs, members] = await Promise.all([
      fetchGroups(userId),
      fetchMemberships(userId).catch(() => []),
    ]);
    const counts = new Map<string, number>();
    for (const m of members) {
      if (m.effective_until == null) counts.set(m.group_id, (counts.get(m.group_id) ?? 0) + 1);
    }
    setGroups(gs);
    setMemberCount(counts);
  }, [userId]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function onCreate() {
    const name = newName.trim();
    if (!name || !userId || busy) return;
    setBusy(true);
    try {
      await createGroup(userId, { name });
      setNewName('');
      await load();
    } catch (err) {
      Alert.alert('Could not create group', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onSaveRename(id: string) {
    const name = editName.trim();
    setEditingId(null);
    if (!name) return;
    try {
      await renameGroup(id, name);
      await load();
    } catch (err) {
      Alert.alert('Could not rename', err instanceof Error ? err.message : String(err));
    }
  }

  function onDelete(group: HabitGroup) {
    const n = memberCount.get(group.id) ?? 0;
    Alert.alert(
      `Delete "${group.name}"?`,
      n > 0
        ? `Its ${n} habit${n === 1 ? '' : 's'} stay, just ungrouped. Past completions are kept.`
        : 'This group has no habits.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteGroup(group.id);
              await load();
            } catch (err) {
              Alert.alert('Could not delete', err instanceof Error ? err.message : String(err));
            }
          },
        },
      ],
    );
  }

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.content}>
        <View style={styles.header}>
          <View style={styles.side} />
          <ThemedText type="defaultSemiBold">Groups</ThemedText>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.sideRight}>
            <ThemedText style={styles.done}>Done</ThemedText>
          </Pressable>
        </View>

        <View style={styles.createRow}>
          <TextInput
            value={newName}
            onChangeText={setNewName}
            placeholder="New group (e.g. Become healthy)"
            placeholderTextColor="rgba(127,127,127,0.5)"
            style={[styles.createInput, { color: textColor }]}
            returnKeyType="done"
            onSubmitEditing={onCreate}
            maxLength={100}
          />
          <Pressable onPress={onCreate} disabled={!newName.trim() || busy} hitSlop={8}>
            <ThemedText style={[styles.add, (!newName.trim() || busy) && styles.disabled]}>
              Add
            </ThemedText>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator style={styles.loading} />
        ) : groups.length === 0 ? (
          <ThemedText style={styles.empty}>
            No groups yet. Create one above to group habits by the identity they build.
          </ThemedText>
        ) : (
          <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
            {groups.map((g) => (
              <GroupManageRow
                key={g.id}
                name={g.name}
                color={g.color}
                count={memberCount.get(g.id) ?? 0}
                editing={editingId === g.id}
                editName={editName}
                textColor={textColor}
                onChangeEditName={setEditName}
                onStartEdit={() => {
                  setEditingId(g.id);
                  setEditName(g.name);
                }}
                onCommitEdit={() => onSaveRename(g.id)}
                onDelete={() => onDelete(g)}
              />
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(127,127,127,0.25)',
  },
  side: { width: 48 },
  sideRight: { width: 48, alignItems: 'flex-end' },
  done: { fontSize: 16, fontWeight: '600' },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(127,127,127,0.15)',
  },
  createInput: { flex: 1, fontSize: 16, padding: 0 },
  add: { fontSize: 16, fontWeight: '600', color: '#0A84FF' },
  disabled: { opacity: 0.4 },
  loading: { marginTop: 32 },
  empty: { padding: 24, opacity: 0.6, fontSize: 15, lineHeight: 21 },
  list: { paddingVertical: 8 },
});
