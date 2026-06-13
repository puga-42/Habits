// "Repeat" detail page (pushed from the habit form's Repeat row). Combines the
// habit kind (Scheduled vs Flex) with its cadence:
//   - Scheduled → an RRULE preset (daily, weekdays, specific weekdays, specific
//     days of the month, every N days, monthly, or one-off).
//   - Flex     → a target period (day / week / month).
// The kind picker is locked on the edit screen (passed via ?lock=1) because
// changing kind mid-lineage isn't supported. Reads/writes the shared draft.

import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useHabitForm } from '@/lib/habit-form';
import type { FlexPeriod } from '@/lib/habits';
import {
  WEEKDAYS,
  WEEKDAY_LABELS,
  describeRrule,
  type Pattern,
  type WeekDay,
} from '@/lib/recurrence';

const PATTERN_OPTIONS: { key: Pattern; label: string }[] = [
  { key: 'oneoff', label: "Doesn't repeat" },
  { key: 'daily', label: 'Daily' },
  { key: 'weekday', label: 'Every weekday' },
  { key: 'weekly', label: 'Specific days of the week' },
  { key: 'monthlyDays', label: 'Specific days of the month' },
  { key: 'interval', label: 'Every N days' },
  { key: 'monthly', label: 'Monthly (same day)' },
];

const PERIOD_OPTIONS: { key: FlexPeriod; label: string }[] = [
  { key: 'day', label: 'Per day' },
  { key: 'week', label: 'Per week' },
  { key: 'month', label: 'Per month' },
];

const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

function RadioRow({
  selected,
  label,
  onPress,
  disabled,
}: {
  selected: boolean;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={[styles.optionRow, disabled && styles.disabled]}>
      <ThemedText style={styles.radio}>{selected ? '●' : '○'}</ThemedText>
      <ThemedText style={styles.optionText}>{label}</ThemedText>
    </Pressable>
  );
}

export default function RepeatScreen() {
  const router = useRouter();
  const { lock } = useLocalSearchParams<{ lock?: string }>();
  const locked = lock === '1';
  const { draft, update } = useHabitForm();
  const textColor = useThemeColor({}, 'text');
  const { recurrence } = draft;

  function setPattern(pattern: Pattern) {
    if (pattern === 'weekly' && recurrence.byDays.length === 0) {
      update({ recurrence: { ...recurrence, pattern, byDays: ['MO', 'WE', 'FR'] } });
    } else if (
      pattern === 'monthlyDays' &&
      (recurrence.byMonthDays ?? []).length === 0
    ) {
      update({ recurrence: { ...recurrence, pattern, byMonthDays: [draft.startsOn.getDate()] } });
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

  function toggleMonthDay(day: number) {
    const cur = recurrence.byMonthDays ?? [];
    const next = cur.includes(day) ? cur.filter((d) => d !== day) : [...cur, day];
    update({ recurrence: { ...recurrence, byMonthDays: next } });
  }

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ThemedText style={styles.headerButton}>‹ Back</ThemedText>
          </Pressable>
          <ThemedText type="defaultSemiBold">Repeat</ThemedText>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ThemedText style={[styles.headerButton, styles.done]}>Done</ThemedText>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <ThemedText style={styles.label}>Type</ThemedText>
          <RadioRow
            selected={draft.kind === 'scheduled'}
            label="Scheduled — on a set schedule"
            onPress={() => update({ kind: 'scheduled' })}
            disabled={locked}
          />
          <RadioRow
            selected={draft.kind === 'flex'}
            label="Flex — a target per period"
            onPress={() => update({ kind: 'flex' })}
            disabled={locked}
          />

          {draft.kind === 'scheduled' ? (
            <>
              <ThemedText style={[styles.label, styles.section]}>Schedule</ThemedText>
              {PATTERN_OPTIONS.map((p) => (
                <RadioRow
                  key={p.key}
                  selected={recurrence.pattern === p.key}
                  label={p.label}
                  onPress={() => setPattern(p.key)}
                />
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
                          style={[styles.dayChip, selected && styles.chipSelected]}>
                          <ThemedText style={[styles.chipText, selected && styles.chipTextSelected]}>
                            {WEEKDAY_LABELS[d]}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}

              {recurrence.pattern === 'monthlyDays' && (
                <View style={styles.subSection}>
                  <ThemedText style={styles.label}>Days of month</ThemedText>
                  <View style={styles.monthGrid}>
                    {MONTH_DAYS.map((d) => {
                      const selected = (recurrence.byMonthDays ?? []).includes(d);
                      return (
                        <Pressable
                          key={d}
                          onPress={() => toggleMonthDay(d)}
                          style={[styles.monthChip, selected && styles.chipSelected]}>
                          <ThemedText style={[styles.chipText, selected && styles.chipTextSelected]}>
                            {d}
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
                      update({ recurrence: { ...recurrence, interval: isNaN(n) || n < 1 ? 1 : n } });
                    }}
                    keyboardType="number-pad"
                    style={[styles.input, { color: textColor }]}
                  />
                </View>
              )}

              <View style={styles.previewBox}>
                <ThemedText style={styles.label}>Preview</ThemedText>
                <ThemedText style={styles.previewText}>{describeRrule(recurrence)}</ThemedText>
              </View>
            </>
          ) : (
            <>
              <ThemedText style={[styles.label, styles.section]}>Period</ThemedText>
              {PERIOD_OPTIONS.map((p) => (
                <RadioRow
                  key={p.key}
                  selected={draft.targetPeriod === p.key}
                  label={p.label}
                  onPress={() => update({ targetPeriod: p.key })}
                />
              ))}
            </>
          )}
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
  scroll: { padding: 20, gap: 8, paddingBottom: 60 },
  label: {
    fontSize: 12,
    opacity: 0.6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  section: { marginTop: 20 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  disabled: { opacity: 0.4 },
  radio: { fontSize: 18, width: 24 },
  optionText: { fontSize: 16 },
  subSection: { gap: 8, marginTop: 8 },
  daysRow: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayChip: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(127,127,127,0.3)',
  },
  monthChip: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(127,127,127,0.3)',
  },
  chipSelected: {
    backgroundColor: 'rgba(127,127,127,0.3)',
    borderColor: 'rgba(127,127,127,0.6)',
  },
  chipText: { fontSize: 14 },
  chipTextSelected: { fontWeight: '600' },
  input: {
    fontSize: 17,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(127,127,127,0.3)',
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
