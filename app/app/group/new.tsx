// Create an IDENTITY (Atomic Habits: habits serve who you're becoming —
// "I am fluent in Spanish"). Mirrors /group/edit: name, description, and the
// habit checklist, reusing the same form components. Nothing is pre-selected
// (buildGroupHabitChoices gets a sentinel id); habits in another identity
// show the move hint. Save creates the row, then files each checked habit.

import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormPageHeader } from '@/components/form-page-header';
import { IdentityForm } from '@/components/identity-form';
import { ThemedView } from '@/components/themed-view';
import { useTokens } from '@/hooks/use-tokens';
import { useAuth } from '@/lib/auth';
import { buildGroupHabitChoices, type GroupHabitChoice } from '@/lib/group-edit';
import { addHabitToGroup, createGroup } from '@/lib/group-mutations';
import { fetchGroups, fetchMemberships } from '@/lib/groups';
import { fetchHabits, isoDate } from '@/lib/habits';
import { errorMessage } from '@/lib/error-message';

// No row exists yet — any id no real identity can have keeps every choice
// unselected while preserving the "In {identity}" hints.
const NEW_SENTINEL = '__new';

export default function NewGroupScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;
  const t = useTokens();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [choices, setChoices] = useState<GroupHabitChoice[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const [habits, memberships, groups] = await Promise.all([
        fetchHabits(userId),
        fetchMemberships(userId),
        fetchGroups(userId),
      ]);
      setChoices(
        buildGroupHabitChoices(habits, memberships, groups, NEW_SENTINEL, isoDate(new Date())),
      );
    })()
      .catch(() => setChoices([]))
      .finally(() => setLoading(false));
  }, [userId]);

  function toggle(lineageId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(lineageId)) next.delete(lineageId);
      else next.add(lineageId);
      return next;
    });
  }

  async function onCreate() {
    if (!userId || saving) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Name required', 'Who does this identity help you become?');
      return;
    }
    setSaving(true);
    try {
      const trimmedDescription = description.trim();
      const id = await createGroup(userId, {
        name: trimmedName,
        description: trimmedDescription ? trimmedDescription : null,
      });
      const todayIso = isoDate(new Date());
      for (const lineageId of selected) {
        await addHabitToGroup(userId, lineageId, id, todayIso);
      }
      router.back();
    } catch (err) {
      Alert.alert('Could not create', errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.content}>
        <FormPageHeader
          title="New identity"
          actionLabel="Create"
          busy={saving}
          busyLabel="Creating…"
          disabled={saving || loading}
          onCancel={() => router.back()}
          onAction={onCreate}
        />

        {loading ? (
          <ActivityIndicator style={styles.loading} />
        ) : (
          <IdentityForm
            name={name}
            description={description}
            choices={choices}
            selected={selected}
            emptyCopy="No habits yet — you can add them here later."
            onChangeName={setName}
            onChangeDescription={setDescription}
            onToggle={toggle}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
  loading: { marginTop: 32 },
});
