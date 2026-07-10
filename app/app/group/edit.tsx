// Edit ONE identity — rename, describe, add/remove member habits, and delete
// (the /groups list is a plain directory; this page is the single edit
// surface). Membership changes reconcile on Save via group-mutations, so the
// one-active-group and time-window semantics hold; derivations live in
// lib/group-edit.ts.

import { StackActions } from '@react-navigation/native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormPageHeader } from '@/components/form-page-header';
import { IdentityForm } from '@/components/identity-form';
import { IdentityPillPreview } from '@/components/identity-pill-preview';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTokens } from '@/hooks/use-tokens';
import { useAuth } from '@/lib/auth';
import {
  buildGroupHabitChoices,
  planMemberEdits,
  updateGroupDetails,
  type GroupHabitChoice,
} from '@/lib/group-edit';
import {
  addHabitToGroup,
  deleteGroup,
  removeHabitFromGroupFuture,
} from '@/lib/group-mutations';
import { fetchGroup } from '@/lib/group-overview';
import { fetchGroups, fetchMemberships } from '@/lib/groups';
import { fetchHabits, isoDate } from '@/lib/habits';
import { errorMessage } from '@/lib/error-message';

export default function EditGroupScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTokens();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [missing, setMissing] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState<string | null>(null);
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
      setColor(group.color ?? null);
      const rows = buildGroupHabitChoices(habits, memberships, groups, id, isoDate(new Date()));
      setChoices(rows);
      const members = rows.filter((r) => r.inGroup).map((r) => r.lineageId);
      setInitialMembers(members);
      setSelected(new Set(members));
    })()
      .catch((err) => {
        Alert.alert('Could not load identity', errorMessage(err));
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
      Alert.alert('Name required', 'Who does this identity help you become?');
      return;
    }
    setSaving(true);
    try {
      const trimmedDescription = description.trim();
      await updateGroupDetails(id, {
        name: trimmedName,
        description: trimmedDescription ? trimmedDescription : null,
        color,
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
      Alert.alert('Could not save', errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function onDelete() {
    if (!id) return;
    Alert.alert(
      `Delete "${name.trim() || 'this identity'}"?`,
      'Its habits stay — they just stop being grouped under this identity. Past completions are kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteGroup(id);
              // Pop past the (now-gone) overview back to wherever we came from.
              navigation.dispatch(StackActions.pop(2));
            } catch (err) {
              Alert.alert('Could not delete', errorMessage(err));
              setDeleting(false);
            }
          },
        },
      ],
    );
  }

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.content}>
        <FormPageHeader
          title="Edit identity"
          actionLabel="Save"
          busy={saving}
          busyLabel="Saving…"
          disabled={saving || deleting || loading || missing}
          onCancel={() => router.back()}
          onAction={onSave}
        />

        <IdentityPillPreview name={name} description={description} color={color} />

        {loading ? (
          <ActivityIndicator style={styles.loading} />
        ) : missing ? (
          <ThemedText style={styles.empty}>This identity no longer exists.</ThemedText>
        ) : (
          <IdentityForm
            name={name}
            description={description}
            color={color}
            choices={choices}
            selected={selected}
            emptyCopy="No habits yet — create one first."
            onChangeName={setName}
            onChangeDescription={setDescription}
            onChangeColor={setColor}
            onToggle={toggle}>
            <Pressable
              onPress={onDelete}
              disabled={deleting || saving}
              style={({ pressed }) => [styles.deleteBtn, pressed && styles.disabled]}
              accessibilityRole="button"
              accessibilityLabel="Delete identity">
              <ThemedText style={[styles.deleteText, { color: t.danger }]}>
                {deleting ? 'Deleting…' : 'Delete identity'}
              </ThemedText>
            </Pressable>
          </IdentityForm>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
  disabled: { opacity: 0.4 },
  loading: { marginTop: 32 },
  empty: { opacity: 0.6, fontSize: 15, lineHeight: 21, paddingVertical: 8 },
  deleteBtn: { marginTop: 36, alignItems: 'center', paddingVertical: 12 },
  deleteText: { fontSize: 16, fontWeight: '600' },
});
