// "Goal" detail page (pushed from the habit form's Goal row). Sets the raw
// target number plus its unit: a simple count ("Times") or a timed duration
// ("Minutes" / "Hours"). Reads/writes the shared habit draft.

import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useHabitForm } from '@/lib/habit-form';
import type { TimeDisplayUnit } from '@/lib/habits';

type UnitKey = 'count' | TimeDisplayUnit;
const UNIT_OPTIONS: { key: UnitKey; label: string }[] = [
  { key: 'count', label: 'Times' },
  { key: 'minutes', label: 'Minutes' },
  { key: 'hours', label: 'Hours' },
];

export default function GoalScreen() {
  const router = useRouter();
  const { draft, update } = useHabitForm();
  const textColor = useThemeColor({}, 'text');

  const isTime = draft.unit === 'time';
  const number = isTime ? draft.targetValue : draft.targetCount;
  const selectedKey: UnitKey = isTime ? draft.displayUnit : 'count';

  function setNumber(t: string) {
    const n = parseInt(t, 10);
    const val = isNaN(n) ? 0 : n;
    if (isTime) update({ targetValue: val });
    else update({ targetCount: val });
  }

  function selectUnit(key: UnitKey) {
    if (key === 'count') update({ unit: 'count' });
    else update({ unit: 'time', displayUnit: key });
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

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <ThemedText style={styles.label}>Amount</ThemedText>
          <TextInput
            value={String(number)}
            onChangeText={setNumber}
            keyboardType="number-pad"
            style={[styles.input, { color: textColor }]}
            selectTextOnFocus
            autoFocus
          />

          <ThemedText style={[styles.label, styles.unitLabel]}>Unit</ThemedText>
          {UNIT_OPTIONS.map((o) => (
            <Pressable key={o.key} onPress={() => selectUnit(o.key)} style={styles.optionRow}>
              <ThemedText style={styles.radio}>{selectedKey === o.key ? '●' : '○'}</ThemedText>
              <ThemedText style={styles.optionText}>{o.label}</ThemedText>
            </Pressable>
          ))}
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
  scroll: { padding: 20, gap: 8 },
  label: {
    fontSize: 12,
    opacity: 0.6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  unitLabel: { marginTop: 16 },
  input: {
    fontSize: 17,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(127,127,127,0.3)',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  radio: { fontSize: 18, width: 24 },
  optionText: { fontSize: 16 },
});
