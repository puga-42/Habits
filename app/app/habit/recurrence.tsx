import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useHabitForm } from '@/lib/habit-form';
import {
  WEEKDAYS,
  WEEKDAY_LABELS,
  describeRrule,
  type Pattern,
  type WeekDay,
} from '@/lib/recurrence';

const PATTERN_OPTIONS: Array<{ key: Pattern; label: string }> = [
  { key: 'oneoff', label: "Doesn't repeat" },
  { key: 'daily', label: 'Daily' },
  { key: 'weekday', label: 'Every weekday' },
  { key: 'weekly', label: 'Specific days of the week' },
  { key: 'interval', label: 'Every N days' },
  { key: 'monthly', label: 'Monthly' },
];

export default function RecurrenceScreen() {
  const router = useRouter();
  const { draft, update } = useHabitForm();
  const { recurrence } = draft;

  function setPattern(pattern: Pattern) {
    if (pattern === 'weekly' && recurrence.byDays.length === 0) {
      update({ recurrence: { ...recurrence, pattern, byDays: ['MO', 'WE', 'FR'] } });
    } else {
      update({ recurrence: { ...recurrence, pattern } });
    }
  }

  function toggleDay(day: WeekDay) {
    const next = recurrence.byDays.includes(day)
      ? recurrence.byDays.filter((d) => d !== day)
      : [...recurrence.byDays, day];
    update({ recurrence: { ...recurrence, byDays: next } });
  }

  function setInterval(n: number) {
    update({ recurrence: { ...recurrence, interval: n } });
  }

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ThemedText style={styles.headerButton}>‹ Back</ThemedText>
          </Pressable>
          <ThemedText type="defaultSemiBold">Repeats</ThemedText>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ThemedText style={[styles.headerButton, styles.done]}>Done</ThemedText>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled">
          <ThemedText style={styles.label}>Pattern</ThemedText>
          {PATTERN_OPTIONS.map((p) => (
            <Pressable
              key={p.key}
              onPress={() => setPattern(p.key)}
              style={styles.patternRow}>
              <ThemedText style={styles.radio}>
                {recurrence.pattern === p.key ? '●' : '○'}
              </ThemedText>
              <ThemedText style={styles.patternText}>{p.label}</ThemedText>
            </Pressable>
          ))}

          {recurrence.pattern === 'weekly' && (
            <View style={styles.subSection}>
              <ThemedText style={styles.label}>Days</ThemedText>
              <View style={styles.daysRow}>
                {WEEKDAYS.map((d) => {
                  const selected = recurrence.byDays.includes(d);
                  return (
                    <Pressable
                      key={d}
                      onPress={() => toggleDay(d)}
                      style={[styles.dayChip, selected && styles.dayChipSelected]}>
                      <ThemedText
                        style={[
                          styles.dayChipText,
                          selected && styles.dayChipTextSelected,
                        ]}>
                        {WEEKDAY_LABELS[d]}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {recurrence.pattern === 'interval' && (
            <View style={styles.subSection}>
              <ThemedText style={styles.label}>Every N days</ThemedText>
              <TextInput
                value={String(recurrence.interval)}
                onChangeText={(t) => {
                  const n = parseInt(t, 10);
                  setInterval(isNaN(n) || n < 1 ? 1 : n);
                }}
                keyboardType="number-pad"
                style={styles.input}
              />
            </View>
          )}

          <View style={styles.previewBox}>
            <ThemedText style={styles.label}>Preview</ThemedText>
            <ThemedText style={styles.previewText}>
              {describeRrule(recurrence)}
            </ThemedText>
          </View>
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
  patternRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  radio: { fontSize: 18, width: 24 },
  patternText: { fontSize: 16 },
  subSection: { gap: 8, marginTop: 16 },
  daysRow: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  dayChip: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(127,127,127,0.3)',
  },
  dayChipSelected: {
    backgroundColor: 'rgba(127,127,127,0.3)',
    borderColor: 'rgba(127,127,127,0.6)',
  },
  dayChipText: { fontSize: 14 },
  dayChipTextSelected: { fontWeight: '600' },
  input: {
    fontSize: 17,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(127,127,127,0.3)',
    color: '#000',
  },
  previewBox: {
    gap: 4,
    marginTop: 24,
    padding: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(127,127,127,0.1)',
  },
  previewText: { fontSize: 16 },
});
