import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HabitFormFields } from '@/components/habit-form-fields';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/lib/auth';
import { draftToInsert, useHabitForm } from '@/lib/habit-form';
import {
  applyEditAll,
  applyEditFuture,
  applyEditThis,
  buildPatch,
  deleteHabitAll,
  deleteHabitFuture,
  fetchHabit,
  type Habit,
  occurrenceMidnight,
} from '@/lib/habits';
import { syncWidgetData } from '@/lib/widget-sync';

type EditScope = 'this' | 'future' | 'all';

export default function EditHabitScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { id, occurrenceDate } = useLocalSearchParams<{
    id: string;
    occurrenceDate?: string;
  }>();
  const { draft, seedFromHabit, reset } = useHabitForm();

  const [habit, setHabit] = useState<Habit | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchHabit(id)
      .then((h) => {
        setHabit(h);
        seedFromHabit(h);
      })
      .catch((err) => {
        Alert.alert('Could not load habit', err instanceof Error ? err.message : String(err));
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function onCancel() {
    reset();
    router.back();
  }

  async function apply(scope: EditScope) {
    if (!habit || !session?.user.id) return;
    setSaving(true);
    try {
      if (scope === 'all' || habit.kind === 'flex') {
        const update = draftToInsert(draft);
        await applyEditAll(habit.id, update);
      } else if (scope === 'future') {
        if (!occurrenceDate) {
          throw new Error('"This and future" needs an occurrence date.');
        }
        const splitTime = occurrenceMidnight(occurrenceDate);
        const newInsert = draftToInsert(draft);
        if (newInsert.kind === 'scheduled') {
          newInsert.dtstart = splitTime.toISOString();
        }
        await applyEditFuture(session.user.id, habit, splitTime, newInsert);
      } else {
        if (!occurrenceDate) throw new Error('"This occurrence only" needs an occurrence date.');
        const patch = buildPatch(habit, draft);
        if (Object.keys(patch).length === 0) { router.back(); return; }
        await applyEditThis(habit.id, occurrenceDate, patch);
      }
      syncWidgetData(session.user.id);
      reset();
      router.back();
    } catch (err) {
      Alert.alert('Could not save', err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  function onSave() {
    if (!habit) return;
    const title = draft.title.trim();
    if (!title) {
      Alert.alert('Title required', 'Give your habit a name first.');
      return;
    }
    if (draft.kind === 'flex' && draft.targetCount < 1) {
      Alert.alert('Target required', 'Flex habits need at least 1 per period.');
      return;
    }
    const isOneOff = habit.rrule === 'FREQ=DAILY;COUNT=1';
    if (habit.kind === 'flex' || isOneOff) {
      apply('all');
      return;
    }
    Alert.alert(
      `Edit "${habit.title}"`,
      'Apply changes to:',
      [
        { text: 'This occurrence only', onPress: () => apply('this') },
        { text: 'This and future', onPress: () => apply('future') },
        { text: 'All occurrences', onPress: () => apply('all') },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }

  async function execDelete(scope: 'all' | 'future') {
    if (!habit) return;
    setDeleting(true);
    try {
      if (scope === 'all') await deleteHabitAll(habit.id);
      else await deleteHabitFuture(habit);
      if (session?.user.id) syncWidgetData(session.user.id);
      reset();
      router.back();
    } catch (err) {
      Alert.alert('Could not delete', err instanceof Error ? err.message : String(err));
    } finally {
      setDeleting(false);
    }
  }

  function onDelete() {
    if (!habit) return;
    const isOneOff = habit.rrule === 'FREQ=DAILY;COUNT=1';
    if (isOneOff) {
      Alert.alert('Delete habit?', 'Past completions will be kept.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => execDelete('all') },
      ]);
      return;
    }
    Alert.alert(`Delete "${habit.title}"`, 'Past completions will be kept.', [
      { text: 'Delete all occurences', style: 'destructive', onPress: () => execDelete('all') },
      { text: 'Delete all future occurences', onPress: () => execDelete('future') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  if (loading || !habit) {
    return (
      <ThemedView style={styles.root}>
        <SafeAreaView edges={['top']} style={[styles.content, styles.centered]}>
          <ActivityIndicator />
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={onCancel} hitSlop={12}>
            <ThemedText style={styles.headerButton}>Cancel</ThemedText>
          </Pressable>
          <ThemedText type="defaultSemiBold">Edit habit</ThemedText>
          <Pressable onPress={onSave} disabled={saving || deleting} hitSlop={12}>
            <ThemedText
              style={[styles.headerButton, styles.save, (saving || deleting) && styles.disabled]}>
              {saving ? 'Saving…' : 'Save'}
            </ThemedText>
          </Pressable>
        </View>
        <HabitFormFields lockKind onDelete={onDelete} />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center' },
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
});
