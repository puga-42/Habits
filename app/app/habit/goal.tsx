// "Goal" detail page (pushed from the habit form's Goal row). Sets the target
// amount plus its unit, grouped iOS-style into Count units (count / steps / reps
// / … ) and Time units (seconds / minutes / hours). Reads/writes the shared
// habit draft. Mirrors the grouped-card look of the habit create/edit form.

import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CardList, FormCard } from '@/components/form-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Palette } from '@/constants/colors';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useHabitForm } from '@/lib/habit-form';
import type { TimeDisplayUnit } from '@/lib/habits';
import { COUNT_UNITS, type CountUnit } from '@/lib/units';

const TIME_UNITS: { key: TimeDisplayUnit; label: string }[] = [
  { key: 'seconds', label: 'Seconds' },
  { key: 'minutes', label: 'Minutes' },
  { key: 'hours', label: 'Hours' },
];

export default function GoalScreen() {
  const router = useRouter();
  const { draft, update } = useHabitForm();
  const textColor = useThemeColor({}, 'text');

  const isTime = draft.unit === 'time';
  const amount = isTime ? draft.targetValue : draft.targetCount;

  function setAmount(t: string) {
    const n = parseInt(t, 10);
    const val = isNaN(n) ? 0 : n;
    if (isTime) update({ targetValue: val });
    else update({ targetCount: val });
  }

  // Switching unit carries the current amount across so only editing the number
  // changes it (the count/time targets are stored separately under the hood).
  function selectCount(key: CountUnit) {
    update({ unit: 'count', countUnit: key, targetCount: amount });
  }
  function selectTime(key: TimeDisplayUnit) {
    update({ unit: 'time', displayUnit: key, targetValue: amount });
  }

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ThemedText style={styles.headerButton}>‹ Back</ThemedText>
          </Pressable>
          <ThemedText type="defaultSemiBold">Goal</ThemedText>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ThemedText style={[styles.headerButton, styles.done]}>Done</ThemedText>
          </Pressable>
        </View>

        <View style={styles.pinned}>
          <FormCard title="Amount">
            <CardList>
              <View style={styles.cell}>
                <TextInput
                  value={String(amount)}
                  onChangeText={setAmount}
                  keyboardType="number-pad"
                  style={[styles.input, { color: textColor }]}
                  selectTextOnFocus
                  autoFocus
                />
              </View>
            </CardList>
          </FormCard>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets>
          <FormCard title="Count">
            <CardList>
              {COUNT_UNITS.map((o) => (
                <Pressable key={o.key} style={styles.row} onPress={() => selectCount(o.key)}>
                  <ThemedText style={styles.rowLabel}>{o.label}</ThemedText>
                  {!isTime && draft.countUnit === o.key && (
                    <ThemedText style={styles.check}>✓</ThemedText>
                  )}
                </Pressable>
              ))}
            </CardList>
          </FormCard>

          <FormCard title="Time">
            <CardList>
              {TIME_UNITS.map((o) => (
                <Pressable key={o.key} style={styles.row} onPress={() => selectTime(o.key)}>
                  <ThemedText style={styles.rowLabel}>{o.label}</ThemedText>
                  {isTime && draft.displayUnit === o.key && (
                    <ThemedText style={styles.check}>✓</ThemedText>
                  )}
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
  pinned: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  scroll: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 60, gap: 24 },
  cell: { paddingHorizontal: 16, paddingVertical: 12 },
  input: { fontSize: 17, padding: 0 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowLabel: { fontSize: 16 },
  check: { fontSize: 17, fontWeight: '700', color: Palette.primary },
});
