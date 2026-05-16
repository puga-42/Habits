import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HabitFormFields } from '@/components/habit-form-fields';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/lib/auth';
import { draftToInsert, useHabitForm } from '@/lib/habit-form';
import { createHabit } from '@/lib/habits';

export default function NewHabitScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { draft, reset } = useHabitForm();
  const [saving, setSaving] = useState(false);

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
      await createHabit(session.user.id, draftToInsert(draft));
      reset();
      router.back();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : (err as any)?.message ?? JSON.stringify(err);
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
        <View style={styles.header}>
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
    borderBottomColor: 'rgba(127,127,127,0.25)',
  },
  headerButton: { fontSize: 16 },
  save: { fontWeight: '600' },
  disabled: { opacity: 0.4 },
});
