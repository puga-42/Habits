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
  fetchHabit,
  formatTime,
  type Habit,
  type OccurrencePatch,
} from '@/lib/habits';

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
        const splitTime = occurrenceTimeFor(occurrenceDate, habit, draft.time);
        const newInsert = draftToInsert(draft);
        // The new habit's dtstart is the split point with the new time-of-day.
        if (newInsert.kind === 'scheduled') {
          newInsert.dtstart = splitTime.toISOString();
        }
        await applyEditFuture(session.user.id, habit, splitTime, newInsert);
      } else {
        // 'this'
        if (!occurrenceDate) {
          throw new Error('"This occurrence only" needs an occurrence date.');
        }
        const patch = buildPatch(habit, draft);
        if (Object.keys(patch).length === 0) {
          // Nothing actually changed in per-occurrence fields. Bail out gracefully.
          router.back();
          return;
        }
        await applyEditThis(habit.id, occurrenceDate, patch);
      }
      reset();
      router.back();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      Alert.alert('Could not save', message);
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
    // Flex habits and one-off scheduled habits have no per-occurrence semantics
    // — there's only one row/state to update.
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
          <Pressable onPress={onSave} disabled={saving} hitSlop={12}>
            <ThemedText
              style={[styles.headerButton, styles.save, saving && styles.disabled]}>
              {saving ? 'Saving…' : 'Save'}
            </ThemedText>
          </Pressable>
        </View>
        <HabitFormFields lockKind />
      </SafeAreaView>
    </ThemedView>
  );
}

// Build the per-occurrence patch by diffing the draft against the original
// habit. Only fields that make sense per-occurrence are included.
function buildPatch(original: Habit, draft: ReturnType<typeof useHabitForm>['draft']): OccurrencePatch {
  const patch: OccurrencePatch = {};
  if (draft.title.trim() !== original.title) patch.title = draft.title.trim();
  if (draft.icon !== original.icon) patch.icon = draft.icon;
  if (draft.color !== original.color) patch.color = draft.color;
  if (original.dtstart) {
    const originalTime = formatTime(new Date(original.dtstart));
    const draftTime = formatTime(draft.time);
    if (originalTime !== draftTime) patch.time = draftTime;
  }
  return patch;
}

// Build the timestamp of the occurrence being edited. Uses the original
// habit's time-of-day so the split lines up with where the existing series
// would have fired on that date.
function occurrenceTimeFor(occurrenceDate: string, original: Habit, _draftTime: Date): Date {
  const [y, m, d] = occurrenceDate.split('-').map((n) => parseInt(n, 10));
  const out = new Date(y, m - 1, d, 0, 0, 0, 0);
  if (original.dtstart) {
    const ot = new Date(original.dtstart);
    out.setHours(ot.getHours(), ot.getMinutes(), 0, 0);
  }
  return out;
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
