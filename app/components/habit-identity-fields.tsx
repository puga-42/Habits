// "General" group of the habit create/edit form: Name, Description, Icon, and
// Color, laid out as rows inside an iOS-style grouped card. These make editing
// discoverable (the pill above is a read-only preview) and write to the shared
// habit draft, so the pill updates live as the user types or picks.

import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ColorPickerModal } from '@/components/color-picker-modal';
import { CardList, FormCard } from '@/components/form-card';
import { ThemedText } from '@/components/themed-text';
import { Palette } from '@/constants/colors';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useHabitForm } from '@/lib/habit-form';

export const HABIT_ICONS = [
  '✨', '🧘', '🏋', '🚶', '📖', '💧', '🍎', '🌱',
  '✍️', '☀️', '☕️', '😴', '🧹', '🚲', '🦷', '💊',
];

export function HabitIdentityFields() {
  const { draft, update } = useHabitForm();
  const textColor = useThemeColor({}, 'text');
  const [showIcons, setShowIcons] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  // Auto-focus the name only when starting from a blank habit, matching the
  // preview pill's previous behavior before editing moved into these fields.
  const [autoFocusName] = useState(() => draft.title.trim().length === 0);

  const color = draft.color ?? Palette.primary;
  const hasIcon = draft.icon.length > 0;

  return (
    <FormCard title="General">
      <CardList>
        <View style={styles.cell}>
          <TextInput
            value={draft.title}
            onChangeText={(t) => update({ title: t })}
            placeholder="Name"
            placeholderTextColor="rgba(127,127,127,0.5)"
            style={[styles.input, { color: textColor }]}
            autoFocus={autoFocusName}
            returnKeyType="done"
          />
        </View>

        <View style={styles.cell}>
          <TextInput
            value={draft.description}
            onChangeText={(t) => update({ description: t })}
            placeholder="Description"
            placeholderTextColor="rgba(127,127,127,0.5)"
            style={[styles.input, styles.multiline, { color: textColor }]}
            multiline
            textAlignVertical="top"
            scrollEnabled={false}
          />
        </View>

        <View>
          <Pressable style={styles.row} onPress={() => setShowIcons((s) => !s)}>
            <ThemedText style={styles.rowLabel}>Icon</ThemedText>
            <View style={styles.rowRight}>
              {hasIcon ? (
                <ThemedText style={styles.rowEmoji}>{draft.icon}</ThemedText>
              ) : (
                <View style={styles.noIcon} />
              )}
              <ThemedText style={styles.chevron}>›</ThemedText>
            </View>
          </Pressable>
          {showIcons && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pickerRow}
              keyboardShouldPersistTaps="handled">
              <Pressable
                onPress={() => update({ icon: '' })}
                accessibilityRole="button"
                accessibilityLabel="No icon"
                style={[styles.iconItem, draft.icon === '' && styles.iconItemSelected]}>
                <View style={styles.noIcon} />
              </Pressable>
              {HABIT_ICONS.map((i) => (
                <Pressable
                  key={i}
                  onPress={() => update({ icon: i })}
                  style={[styles.iconItem, draft.icon === i && styles.iconItemSelected]}>
                  <ThemedText style={styles.iconEmoji}>{i}</ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>

        <Pressable style={styles.row} onPress={() => setColorOpen(true)}>
          <ThemedText style={styles.rowLabel}>Color</ThemedText>
          <View style={styles.rowRight}>
            <View style={[styles.swatch, { backgroundColor: color }]} />
            <ThemedText style={styles.chevron}>›</ThemedText>
          </View>
        </Pressable>
      </CardList>

      <ColorPickerModal
        visible={colorOpen}
        value={color}
        onChange={(hex) => update({ color: hex })}
        onClose={() => setColorOpen(false)}
      />
    </FormCard>
  );
}

const styles = StyleSheet.create({
  cell: { paddingHorizontal: 16, paddingVertical: 12 },
  input: { fontSize: 16, padding: 0 },
  multiline: { minHeight: 48 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowLabel: { fontSize: 16 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowEmoji: { fontSize: 22 },
  chevron: { fontSize: 22, opacity: 0.4 },
  swatch: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.4)',
  },
  pickerRow: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
    alignItems: 'center',
  },
  iconItem: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(127,127,127,0.2)',
  },
  iconItemSelected: {
    borderColor: 'rgba(127,127,127,0.7)',
    backgroundColor: 'rgba(127,127,127,0.12)',
  },
  iconEmoji: { fontSize: 22 },
  noIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(127,127,127,0.6)',
  },
});
