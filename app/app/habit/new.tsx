import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HabitFormFields } from '@/components/habit-form-fields';
import { HabitPillPreview } from '@/components/habit-pill-preview';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTokens } from '@/hooks/use-tokens';
import { resyncHabitAlerts } from '@/lib/alert-scheduler';
import { useAuth } from '@/lib/auth';
import { addHabitToGroup } from '@/lib/group-mutations';
import { draftToInsert, useHabitForm } from '@/lib/habit-form';
import { createHabit, isoDate } from '@/lib/habits';
import { syncWidgetData } from '@/lib/widget-sync';
import { errorMessage } from '@/lib/error-message';

export default function NewHabitScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { draft, reset } = useHabitForm();
  const [saving, setSaving] = useState(false);
  const t = useTokens();

  async function onSave() {
    const title = draft.title.trim();
    if (!title) {
      Alert.alert('Title required', 'Give your habit a name first.');
      return;
    }
    if (draft.kind === 'flex' && draft.targetCount < 1) {
      Alert.alert('Target required', 'Flex habits need at least 1 per period.');
      return;
    }
    if (!session?.user.id) return;

    setSaving(true);
    try {
      // A new root habit's lineage_id equals its id (set by the lineage trigger),
      // so the returned id is the lineage to attach group membership to.
      const newId = await createHabit(session.user.id, draftToInsert(draft));
      if (draft.groupId) {
        await addHabitToGroup(session.user.id, newId, draft.groupId, isoDate(new Date()));
      }
      syncWidgetData(session.user.id);
      resyncHabitAlerts(session.user.id);
      reset();
      router.back();
    } catch (err) {
      const message =
        errorMessage(err);
      Alert.alert('Could not save', message);
    } finally {
      setSaving(false);
    }
  }

  function onCancel() {
    reset();
    router.back();
  }

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.content}>
        <View style={[styles.header, { borderBottomColor: t.hairlineStrong }]}>
          <Pressable onPress={onCancel} hitSlop={12}>
            <ThemedText style={styles.headerButton}>Cancel</ThemedText>
          </Pressable>
          <ThemedText type="defaultSemiBold">New habit</ThemedText>
          <Pressable onPress={onSave} disabled={saving} hitSlop={12}>
            <ThemedText
              style={[styles.headerButton, styles.save, saving && styles.disabled]}>
              {saving ? 'Saving…' : 'Save'}
            </ThemedText>
          </Pressable>
        </View>
        <HabitPillPreview />
        <HabitFormFields />
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
  },
  headerButton: { fontSize: 16 },
  save: { fontWeight: '600' },
  disabled: { opacity: 0.4 },
});
