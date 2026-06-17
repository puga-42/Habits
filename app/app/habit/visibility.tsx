// "Visibility" detail page (pushed from the habit form's Visibility row). Picks
// who can see the habit: Public / Friends / Private. Grouped iOS-style into a
// card, mirroring the Goal and Repeat pages. Reads/writes the shared draft.

import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CardList, FormCard } from '@/components/form-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Palette } from '@/constants/colors';
import { useHabitForm } from '@/lib/habit-form';
import type { Visibility } from '@/lib/habits';

const OPTIONS: { key: Visibility; label: string; description: string }[] = [
  { key: 'public', label: 'Public', description: 'Anyone can see' },
  { key: 'friends', label: 'Friends', description: 'Only your friends' },
  { key: 'private', label: 'Private', description: 'Only you' },
];

export default function VisibilityScreen() {
  const router = useRouter();
  const { draft, update } = useHabitForm();

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ThemedText style={styles.headerButton}>‹ Back</ThemedText>
          </Pressable>
          <ThemedText type="defaultSemiBold">Visibility</ThemedText>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ThemedText style={[styles.headerButton, styles.done]}>Done</ThemedText>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <FormCard title="Visibility">
            <CardList>
              {OPTIONS.map((o) => (
                <Pressable key={o.key} style={styles.row} onPress={() => update({ visibility: o.key })}>
                  <View style={styles.rowMain}>
                    <ThemedText style={styles.rowLabel}>{o.label}</ThemedText>
                    <ThemedText style={styles.rowSub}>{o.description}</ThemedText>
                  </View>
                  {draft.visibility === o.key && <ThemedText style={styles.check}>✓</ThemedText>}
                </Pressable>
              ))}
            </CardList>
          </FormCard>
        </ScrollView>
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
  done: { fontWeight: '600' },
  scroll: { padding: 20, paddingBottom: 60, gap: 24 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowMain: { flex: 1 },
  rowLabel: { fontSize: 16 },
  rowSub: { fontSize: 13, opacity: 0.55, marginTop: 2 },
  check: { fontSize: 17, fontWeight: '700', color: Palette.primary },
});
