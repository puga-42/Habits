// Edit ONE group — rename, describe, and add/remove member habits. Reached
// from the group overview's Edit button (the manage-all list stays at
// /groups). Membership changes reconcile on Save via group-mutations, so the
// one-active-group and time-window semantics hold; derivations live in
// lib/group-edit.ts.

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GroupEditDetails } from '@/components/group-edit-details';
import { GroupEditHabitRow } from '@/components/group-edit-habit-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/lib/auth';
import {
  buildGroupHabitChoices,
  planMemberEdits,
  updateGroupDetails,
  type GroupHabitChoice,
} from '@/lib/group-edit';
import { addHabitToGroup, removeHabitFromGroupFuture } from '@/lib/group-mutations';
import { fetchGroup } from '@/lib/group-overview';
import { fetchGroups, fetchMemberships } from '@/lib/groups';
import { fetchHabits, isoDate } from '@/lib/habits';

export default function EditGroupScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { id } = useLocalSearchParams<{ id: string }>();
  const textColor = useThemeColor({}, 'text');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [missing, setMissing] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [choices, setChoices] = useState<GroupHabitChoice[]>([]);
  const [initialMembers, setInitialMembers] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!id || !userId) return;
    (async () => {
      const [group, habits, memberships, groups] = await Promise.all([
        fetchGroup(id),
        fetchHabits(userId),
        fetchMemberships(userId),
        fetchGroups(userId),
      ]);
      if (!group) {
        setMissing(true);
        return;
      }
      setName(group.name);
      setDescription(group.description ?? '');
      const rows = buildGroupHabitChoices(habits, memberships, groups, id, isoDate(new Date()));
      setChoices(rows);
      const members = rows.filter((r) => r.inGroup).map((r) => r.lineageId);
      setInitialMembers(members);
      setSelected(new Set(members));
    })()
      .catch((err) => {
        Alert.alert('Could not load group', err instanceof Error ? err.message : String(err));
      })
      .finally(() => setLoading(false));
  }, [id, userId]);

  function toggle(lineageId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(lineageId)) next.delete(lineageId);
      else next.add(lineageId);
      return next;
    });
  }

  async function onSave() {
    if (!id || !userId || saving) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Name required', 'Give your group a name first.');
      return;
    }
    setSaving(true);
    try {
      const trimmedDescription = description.trim();
      await updateGroupDetails(id, {
        name: trimmedName,
        description: trimmedDescription ? trimmedDescription : null,
      });
      const plan = planMemberEdits(initialMembers, [...selected]);
      const todayIso = isoDate(new Date());
      for (const lineageId of plan.removeLineageIds) {
        await removeHabitFromGroupFuture(lineageId, id, todayIso);
      }
      for (const lineageId of plan.addLineageIds) {
        await addHabitToGroup(userId, lineageId, id, todayIso);
      }
      router.back();
    } catch (err) {
      Alert.alert('Could not save', err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ThemedText style={styles.headerButton}>Cancel</ThemedText>
          </Pressable>
          <ThemedText type="defaultSemiBold">Edit group</ThemedText>
          <Pressable onPress={onSave} disabled={saving || loading || missing} hitSlop={12}>
            <ThemedText
              style={[styles.headerButton, styles.save, (saving || loading) && styles.disabled]}>
              {saving ? 'Saving…' : 'Save'}
            </ThemedText>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator style={styles.loading} />
        ) : missing ? (
          <ThemedText style={styles.empty}>This group no longer exists.</ThemedText>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            automaticallyAdjustKeyboardInsets>
            <GroupEditDetails
              name={name}
              description={description}
              textColor={textColor}
              onChangeName={setName}
              onChangeDescription={setDescription}
            />

            <ThemedText style={styles.label}>Habits</ThemedText>
            {choices.length === 0 ? (
              <ThemedText style={styles.empty}>No habits yet — create one first.</ThemedText>
            ) : (
              choices.map((choice) => (
                <GroupEditHabitRow
                  key={choice.lineageId}
                  choice={choice}
                  selected={selected.has(choice.lineageId)}
                  onToggle={() => toggle(choice.lineageId)}
                />
              ))
            )}
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
  headerButton: { fontSize: 16 },
  save: { fontWeight: '600' },
  disabled: { opacity: 0.4 },
  loading: { marginTop: 32 },
  scroll: { paddingHorizontal: 16, paddingBottom: 48 },
  label: {
    fontSize: 12,
    opacity: 0.55,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 20,
    marginBottom: 6,
  },
  empty: { opacity: 0.6, fontSize: 15, lineHeight: 21, paddingVertical: 8 },
});
