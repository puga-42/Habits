import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { StackActions } from '@react-navigation/native';
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
import { HabitPillPreview } from '@/components/habit-pill-preview';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/lib/auth';
import {
  addHabitToGroup,
  removeHabitFromGroupFuture,
} from '@/lib/group-mutations';
import {
  activeGroupIdFor,
  fetchMemberships,
  planGroupChange,
} from '@/lib/groups';
import { draftToInsert, useHabitForm } from '@/lib/habit-form';
import {
  applyEditAll,
  applyEditFuture,
  applyEditThis,
  buildPatch,
  deleteHabitAll,
  deleteHabitFuture,
  fetchHabit,
  isoDate,
  type Habit,
  occurrenceMidnight,
} from '@/lib/habits';
import { syncWidgetData } from '@/lib/widget-sync';

type EditScope = 'this' | 'future' | 'all';

export default function EditHabitScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { session } = useAuth();
  const { id, occurrenceDate } = useLocalSearchParams<{
    id: string;
    occurrenceDate?: string;
  }>();
  const { draft, update, seedFromHabit, reset } = useHabitForm();

  const [habit, setHabit] = useState<Habit | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // The group the habit is in on load, so save can reconcile against the picker.
  const [initialGroupId, setInitialGroupId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchHabit(id)
      .then(async (h) => {
        setHabit(h);
        seedFromHabit(h);
        // Seed the group picker from the active membership (kept off the habit
        // row — see habit_group_members). Best-effort: failure leaves it ungrouped.
        try {
          const members = await fetchMemberships(h.owner_id);
          const gid = activeGroupIdFor(members, h.lineage_id, isoDate(new Date()));
          setInitialGroupId(gid);
          update({ groupId: gid });
        } catch {
          // ignore — picker stays on "None"
        }
      })
      .catch((err) => {
        Alert.alert('Could not load habit', err instanceof Error ? err.message : String(err));
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Apply the group picker change (membership is lineage-level, independent of
  // the this/future/all occurrence scope).
  async function reconcileGroup() {
    if (!habit || !session?.user.id) return;
    const change = planGroupChange(initialGroupId, draft.groupId);
    const todayIso = isoDate(new Date());
    if (change.kind === 'add') {
      await addHabitToGroup(session.user.id, habit.lineage_id, change.groupId, todayIso);
    } else if (change.kind === 'remove') {
      await removeHabitFromGroupFuture(habit.lineage_id, change.groupId, todayIso);
    }
  }

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
        if (Object.keys(patch).length === 0) {
          // No field changes, but the group may still have changed.
          await reconcileGroup();
          router.back();
          return;
        }
        await applyEditThis(habit.id, occurrenceDate, patch);
      }
      await reconcileGroup();
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
      navigation.getParent()?.dispatch(StackActions.pop());
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
        <HabitPillPreview />
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
