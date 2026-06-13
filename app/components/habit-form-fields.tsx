// Shared form fields used by both the create (`/habit/new`) and edit
// (`/habit/[id]`) screens. The screens own their own header + save logic.

import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { describeGoal, describeRepeat, useHabitForm } from '@/lib/habit-form';
import { clampEndDate, defaultEndDate } from '@/lib/habit-ends';
import type { Visibility } from '@/lib/habits';

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

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets>
      {/* Title, description, and icon are edited from the pinned preview pill. */}

      <Row label="Goal" onPress={() => router.push('/habit/goal')}>
        <ThemedText style={styles.rowValue}>{describeGoal(draft)}</ThemedText>
        <ThemedText style={styles.chevron}>›</ThemedText>
      </Row>

      <Row
        label="Repeat"
        onPress={() => router.push(lockKind ? '/habit/repeat?lock=1' : '/habit/repeat')}>
        <ThemedText style={styles.rowValue}>{describeRepeat(draft)}</ThemedText>
        <ThemedText style={styles.chevron}>›</ThemedText>
      </Row>

      {draft.kind === 'scheduled' && (
        <>
          <StartsOnRow value={draft.startsOn} onChange={(d) => update({ startsOn: d })} />
          <EndsOnRow
            start={draft.startsOn}
            value={draft.endsOn}
            onChange={(d) => update({ endsOn: d })}
          />
        </>
      )}

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

function EndsOnRow({
  start,
  value,
  onChange,
}: {
  start: Date;
  value: Date | null;
  onChange: (d: Date | null) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);

  function enable() {
    onChange(defaultEndDate(start));
    if (Platform.OS === 'android') setShowPicker(true);
  }

  function handleChange(e: DateTimePickerEvent, date?: Date) {
    if (Platform.OS === 'android') setShowPicker(false);
    if (date) onChange(clampEndDate(start, date));
  }

  if (value === null) {
    return (
      <Row label="Ends" onPress={enable}>
        <ThemedText style={styles.rowValue}>Never</ThemedText>
        <ThemedText style={styles.chevron}>›</ThemedText>
      </Row>
    );
  }

  if (Platform.OS === 'android') {
    return (
      <>
        <Row label="Ends" onPress={() => setShowPicker(true)}>
          <ThemedText style={styles.rowValue}>{value.toLocaleDateString()}</ThemedText>
          <Pressable onPress={() => onChange(null)} hitSlop={8}>
            <ThemedText style={styles.clear}>Never</ThemedText>
          </Pressable>
        </Row>
        {showPicker && (
          <DateTimePicker
            value={value}
            mode="date"
            display="default"
            minimumDate={start}
            onChange={handleChange}
          />
        )}
      </>
    );
  }

  return (
    <Row label="Ends">
      <Pressable onPress={() => onChange(null)} hitSlop={8}>
        <ThemedText style={styles.clear}>Never</ThemedText>
      </Pressable>
      <DateTimePicker
        value={value}
        mode="date"
        display="compact"
        minimumDate={start}
        onChange={handleChange}
      />
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
  clear: { fontSize: 14, opacity: 0.55 },
  chevron: { fontSize: 22, opacity: 0.4 },
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
