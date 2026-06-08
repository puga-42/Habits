// Shared form fields used by both the create (`/habit/new`) and edit
// (`/habit/[id]`) screens. The screens own their own header + save logic.

import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useHabitForm } from '@/lib/habit-form';
import type { FlexPeriod, HabitUnit, TimeDisplayUnit, Visibility } from '@/lib/habits';
import { describeRrule } from '@/lib/recurrence';

import { Palette } from '@/constants/colors';

const COLORS = Palette.habitColors;
const ICONS = ['✨', '🧘', '🏋', '🚶', '📖', '💧', '🍎', '🌱', '✍️', '☀️', '😴', '🧹', '☕️', '🚲', '🦷', '💊'];
const PERIODS: FlexPeriod[] = ['day', 'week', 'month'];
const UNITS: HabitUnit[] = ['count', 'time'];
const UNIT_LABELS: Record<HabitUnit, string> = { count: 'Count', time: 'Time' };
const DISPLAY_UNITS: TimeDisplayUnit[] = ['seconds', 'minutes', 'hours'];
const DISPLAY_UNIT_LABELS: Record<TimeDisplayUnit, string> = { seconds: 'sec', minutes: 'min', hours: 'hr' };
const VISIBILITY_OPTIONS: Visibility[] = ['public', 'friends', 'private'];
const VISIBILITY_LABELS: Record<Visibility, string> = {
  public: 'Public — anyone can see',
  friends: 'Friends — only your friends',
  private: 'Private — only you',
};

type Props = {
  lockKind?: boolean;
  onDelete?: () => void;
};

export function HabitFormFields({ lockKind = false, onDelete }: Props) {
  const router = useRouter();
  const { draft, update } = useHabitForm();
  const textColor = useThemeColor({}, 'text');

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      {/* Title */}
      <View style={styles.section}>
        <ThemedText style={styles.label}>Title</ThemedText>
        <TextInput
          value={draft.title}
          onChangeText={(t) => update({ title: t })}
          placeholder="e.g. Meditate"
          placeholderTextColor="rgba(127,127,127,0.5)"
          style={[styles.input, { color: textColor }]}
          autoFocus={!draft.title}
          returnKeyType="done"
        />
      </View>

      {/* Description */}
      <View style={styles.section}>
        <ThemedText style={styles.label}>Description</ThemedText>
        <TextInput
          value={draft.description}
          onChangeText={(t) => update({ description: t })}
          placeholder="Optional — what's this habit about?"
          placeholderTextColor="rgba(127,127,127,0.5)"
          style={[styles.input, styles.textArea, { color: textColor }]}
          multiline
          textAlignVertical="top"
        />
      </View>

      {/* Kind */}
      <View style={styles.section}>
        <ThemedText style={styles.label}>Kind</ThemedText>
        <View style={[styles.segment, lockKind && styles.disabled]}>
          {(['scheduled', 'flex'] as const).map((k) => (
            <Pressable
              key={k}
              disabled={lockKind}
              onPress={() => update({ kind: k })}
              style={[styles.segmentItem, draft.kind === k && styles.segmentItemActive]}>
              <ThemedText
                style={[
                  styles.segmentText,
                  draft.kind === k && styles.segmentTextActive,
                ]}>
                {k === 'scheduled' ? 'Scheduled' : 'Flex'}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Unit */}
      <View style={styles.section}>
        <ThemedText style={styles.label}>Unit</ThemedText>
        <View style={styles.segment}>
          {UNITS.map((u) => (
            <Pressable
              key={u}
              onPress={() => update({ unit: u })}
              style={[styles.segmentItem, draft.unit === u && styles.segmentItemActive]}>
              <ThemedText
                style={[styles.segmentText, draft.unit === u && styles.segmentTextActive]}>
                {UNIT_LABELS[u]}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </View>

      {draft.unit === 'time' && (
        <View style={styles.section}>
          <ThemedText style={styles.label}>Duration</ThemedText>
          <View style={styles.durationRow}>
            <TextInput
              value={String(draft.targetValue)}
              onChangeText={(t) => {
                const n = parseInt(t, 10);
                update({ targetValue: isNaN(n) ? 0 : n });
              }}
              keyboardType="number-pad"
              style={[styles.input, styles.durationInput, { color: textColor }]}
            />
            <View style={styles.segment}>
              {DISPLAY_UNITS.map((du) => (
                <Pressable
                  key={du}
                  onPress={() => update({ displayUnit: du })}
                  style={[styles.segmentItem, draft.displayUnit === du && styles.segmentItemActive]}>
                  <ThemedText
                    style={[styles.segmentText, draft.displayUnit === du && styles.segmentTextActive]}>
                    {DISPLAY_UNIT_LABELS[du]}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      )}

      {draft.kind === 'scheduled' ? (
        <>
          <Row label="Repeats" onPress={() => router.push('/habit/recurrence')}>
            <ThemedText style={styles.rowValue}>{describeRrule(draft.recurrence)}</ThemedText>
            <ThemedText style={styles.chevron}>›</ThemedText>
          </Row>
          <StartsOnRow value={draft.startsOn} onChange={(d) => update({ startsOn: d })} />
        </>
      ) : (
        <>
          <View style={styles.section}>
            <ThemedText style={styles.label}>Target</ThemedText>
            <TextInput
              value={String(draft.targetCount)}
              onChangeText={(t) => {
                const n = parseInt(t, 10);
                update({ targetCount: isNaN(n) ? 0 : n });
              }}
              keyboardType="number-pad"
              style={[styles.input, { color: textColor }]}
            />
          </View>
          <View style={styles.section}>
            <ThemedText style={styles.label}>Per</ThemedText>
            <View style={styles.segment}>
              {PERIODS.map((p) => (
                <Pressable
                  key={p}
                  onPress={() => update({ targetPeriod: p })}
                  style={[
                    styles.segmentItem,
                    draft.targetPeriod === p && styles.segmentItemActive,
                  ]}>
                  <ThemedText
                    style={[
                      styles.segmentText,
                      draft.targetPeriod === p && styles.segmentTextActive,
                    ]}>
                    {p}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        </>
      )}

      {/* Color */}
      <View style={styles.section}>
        <ThemedText style={styles.label}>Color</ThemedText>
        <View style={styles.swatchRow}>
          {COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => update({ color: c })}
              style={[
                styles.swatch,
                { backgroundColor: c },
                draft.color === c && styles.swatchSelected,
              ]}
            />
          ))}
        </View>
      </View>

      {/* Icon */}
      <View style={styles.section}>
        <ThemedText style={styles.label}>Icon</ThemedText>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.iconRow}>
          {ICONS.map((i) => (
            <Pressable
              key={i}
              onPress={() => update({ icon: i })}
              style={[styles.iconItem, draft.icon === i && styles.iconItemSelected]}>
              <ThemedText style={styles.iconEmoji}>{i}</ThemedText>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Visibility */}
      <View style={styles.section}>
        <ThemedText style={styles.label}>Visibility</ThemedText>
        {VISIBILITY_OPTIONS.map((v) => (
          <Pressable
            key={v}
            onPress={() => update({ visibility: v })}
            style={styles.visibilityRow}>
            <ThemedText style={styles.radio}>
              {draft.visibility === v ? '●' : '○'}
            </ThemedText>
            <ThemedText style={styles.visibilityText}>
              {VISIBILITY_LABELS[v]}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      {onDelete && (
        <Pressable onPress={onDelete} style={styles.deleteButton}>
          <ThemedText style={styles.deleteText}>Delete Habit</ThemedText>
        </Pressable>
      )}
    </ScrollView>
  );
}

function StartsOnRow({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  const [showPicker, setShowPicker] = useState(false);

  function handleChange(e: DateTimePickerEvent, date?: Date) {
    if (Platform.OS === 'android') setShowPicker(false);
    if (date) onChange(date);
  }

  if (Platform.OS === 'android') {
    return (
      <>
        <Row label="Starts" onPress={() => setShowPicker(true)}>
          <ThemedText style={styles.rowValue}>
            {value.toLocaleDateString()}
          </ThemedText>
          <ThemedText style={styles.chevron}>›</ThemedText>
        </Row>
        {showPicker && (
          <DateTimePicker value={value} mode="date" display="default" onChange={handleChange} />
        )}
      </>
    );
  }

  return (
    <Row label="Starts">
      <DateTimePicker value={value} mode="date" display="compact" onChange={handleChange} />
    </Row>
  );
}

function Row({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress?: () => void;
  children: React.ReactNode;
}) {
  const inner = (
    <View style={styles.row}>
      <ThemedText style={styles.rowLabel}>{label}</ThemedText>
      <View style={styles.rowRight}>{children}</View>
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{inner}</Pressable> : inner;
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 80, gap: 18 },
  section: { gap: 8 },
  label: {
    fontSize: 12,
    opacity: 0.6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    fontSize: 17,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(127,127,127,0.3)',
  },
  textArea: {
    minHeight: 80,
    paddingTop: 10,
  },
  durationRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  durationInput: {
    width: 80,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: Palette.lavenderMuted,
    borderRadius: 8,
    padding: 4,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  segmentItemActive: { backgroundColor: Palette.primary },
  segmentText: { fontSize: 15, opacity: 0.65 },
  segmentTextActive: { color: Palette.charcoal, opacity: 1, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(127,127,127,0.25)',
  },
  rowLabel: { fontSize: 16 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowValue: { fontSize: 16, opacity: 0.65 },
  chevron: { fontSize: 22, opacity: 0.4 },
  swatchRow: { flexDirection: 'row', gap: 12 },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchSelected: {
    borderColor: 'rgba(0,0,0,0.4)',
    transform: [{ scale: 1.1 }],
  },
  iconRow: { paddingRight: 16 },
  iconItem: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(127,127,127,0.2)',
  },
  iconItemSelected: {
    borderColor: 'rgba(127,127,127,0.7)',
    backgroundColor: 'rgba(127,127,127,0.12)',
  },
  iconEmoji: { fontSize: 22 },
  visibilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  radio: { fontSize: 18, width: 24 },
  visibilityText: { fontSize: 15, flex: 1 },
  deleteButton: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: 'rgba(239,68,68,0.1)',
    alignItems: 'center',
  },
  deleteText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
  },
});
