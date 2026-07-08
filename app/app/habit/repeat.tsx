// "Repeat" detail page (pushed from the habit form's Repeat row). Combines the
// habit kind (Scheduled vs Flex) with its cadence:
//   - Scheduled → an RRULE preset (daily, weekdays, specific weekdays, specific
//     days of the month, every N days, monthly, or one-off).
//   - Flex     → a target period (day / week / month).
// The kind picker is locked on the edit screen (passed via ?lock=1) because
// changing kind mid-lineage isn't supported. Reads/writes the shared draft.
// Grouped iOS-style into cards, mirroring the Goal page.

import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CardList, FormCard } from '@/components/form-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { withAlpha } from '@/constants/colors';
import { useTokens } from '@/hooks/use-tokens';
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

function SelectRow({
  selected,
  label,
  description,
  onPress,
  disabled,
}: {
  selected: boolean;
  label: string;
  description?: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const t = useTokens();
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={[styles.row, disabled && styles.disabled]}>
      <View style={styles.rowMain}>
        <ThemedText style={styles.rowLabel}>{label}</ThemedText>
        {description ? <ThemedText style={styles.rowSub}>{description}</ThemedText> : null}
      </View>
      {selected && <ThemedText style={[styles.check, { color: t.accent }]}>✓</ThemedText>}
    </Pressable>
  );
}

export default function RepeatScreen() {
  const router = useRouter();
  const { lock } = useLocalSearchParams<{ lock?: string }>();
  const locked = lock === '1';
  const { draft, update } = useHabitForm();
  const t = useTokens();
  const { recurrence } = draft;
  const chipSelected = {
    backgroundColor: withAlpha(t.accent, 0.18),
    borderColor: t.accent,
  };

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
        <View style={[styles.header, { borderBottomColor: t.hairlineStrong }]}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ThemedText style={styles.headerButton}>‹ Back</ThemedText>
          </Pressable>
          <ThemedText type="defaultSemiBold">Repeat</ThemedText>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ThemedText style={[styles.headerButton, styles.done]}>Done</ThemedText>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets>
          <FormCard title="Type">
            <CardList>
              <SelectRow
                selected={draft.kind === 'scheduled'}
                label="Scheduled"
                description="On a set schedule"
                onPress={() => update({ kind: 'scheduled' })}
                disabled={locked}
              />
              <SelectRow
                selected={draft.kind === 'flex'}
                label="Flex"
                description="A target per period"
                onPress={() => update({ kind: 'flex' })}
                disabled={locked}
              />
            </CardList>
          </FormCard>

          {draft.kind === 'scheduled' ? (
            <>
              <FormCard title="Schedule">
                <CardList>
                  {PATTERN_OPTIONS.map((p) => (
                    <SelectRow
                      key={p.key}
                      selected={recurrence.pattern === p.key}
                      label={p.label}
                      onPress={() => setPattern(p.key)}
                    />
                  ))}
                </CardList>
              </FormCard>

              {recurrence.pattern === 'weekly' && (
                <FormCard title="Days">
                  <View style={styles.cell}>
                    <View style={styles.daysRow}>
                      {WEEKDAYS.map((d) => {
                        const selected = recurrence.byDays.includes(d);
                        return (
                          <Pressable
                            key={d}
                            onPress={() => toggleDay(d)}
                            style={[styles.dayChip, { borderColor: t.hairlineStrong }, selected && chipSelected]}>
                            <ThemedText
                              style={[
                                styles.chipText,
                                selected && [styles.chipTextSelected, { color: t.accent }],
                              ]}>
                              {WEEKDAY_LABELS[d]}
                            </ThemedText>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                </FormCard>
              )}

              {recurrence.pattern === 'monthlyDays' && (
                <FormCard title="Days of month">
                  <View style={styles.cell}>
                    <View style={styles.monthGrid}>
                      {MONTH_DAYS.map((d) => {
                        const selected = (recurrence.byMonthDays ?? []).includes(d);
                        return (
                          <Pressable
                            key={d}
                            onPress={() => toggleMonthDay(d)}
                            style={[styles.monthChip, { borderColor: t.hairlineStrong }, selected && chipSelected]}>
                            <ThemedText
                              style={[
                                styles.chipText,
                                selected && [styles.chipTextSelected, { color: t.accent }],
                              ]}>
                              {d}
                            </ThemedText>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                </FormCard>
              )}

              {recurrence.pattern === 'interval' && (
                <FormCard title="Every N days">
                  <View style={styles.cell}>
                    <View style={styles.intervalRow}>
                      <TextInput
                        value={String(recurrence.interval)}
                        onChangeText={(t) => {
                          const n = parseInt(t, 10);
                          update({ recurrence: { ...recurrence, interval: isNaN(n) || n < 1 ? 1 : n } });
                        }}
                        keyboardType="number-pad"
                        style={[styles.input, { color: t.ink }]}
                        selectTextOnFocus
                      />
                      <ThemedText style={styles.intervalSuffix}>days</ThemedText>
                    </View>
                  </View>
                </FormCard>
              )}

              <ThemedText style={styles.footer}>{describeRrule(recurrence)}</ThemedText>
            </>
          ) : (
            <FormCard title="Period">
              <CardList>
                {PERIOD_OPTIONS.map((p) => (
                  <SelectRow
                    key={p.key}
                    selected={draft.targetPeriod === p.key}
                    label={p.label}
                    onPress={() => update({ targetPeriod: p.key })}
                  />
                ))}
              </CardList>
            </FormCard>
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
  check: { fontSize: 17, fontWeight: '700' },
  disabled: { opacity: 0.4 },
  cell: { paddingHorizontal: 16, paddingVertical: 12 },
  daysRow: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayChip: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
    borderWidth: 1,
  },
  monthChip: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
  },
  chipText: { fontSize: 14 },
  chipTextSelected: { fontWeight: '700' },
  intervalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  input: { fontSize: 17, padding: 0, minWidth: 40 },
  intervalSuffix: { fontSize: 16, opacity: 0.6 },
  footer: {
    fontSize: 13,
    opacity: 0.55,
    paddingHorizontal: 16,
    marginTop: -12,
  },
});
