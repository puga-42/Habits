// Pinned, editable preview of how the habit will look on the calendar. Mirrors
// the visual language of `AgendaRow` (tinted pill, colored icon circle, title +
// description) but the icon, name, description, and color are edited in place:
//   - tap the icon circle   → expand the inline emoji picker below the pill
//   - tap the name          → focus the name field (auto-focused for new habits)
//   - tap the description   → focus the description field
//   - tap the color swatch  → expand the inline color picker below the pill
// The icon circle shows a dashed "+" placeholder until an icon is chosen. The
// color swatch lives where the calendar's completion marker sits. Reads/writes
// the shared habit draft, so it updates live as the user edits.

import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';

import { ColorPickerModal } from '@/components/color-picker-modal';
import { ColorWheelIcon } from '@/components/color-wheel-icon';
import { ThemedText } from '@/components/themed-text';
import { Palette, solidTint } from '@/constants/colors';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useHabitForm } from '@/lib/habit-form';

export const HABIT_ICONS = [
  '✨', '🧘', '🏋', '🚶', '📖', '💧', '🍎', '🌱',
  '✍️', '☀️', '☕️', '😴', '🧹', '🚲', '🦷', '💊',
];

const PILL_TINT = 0.22;

export function HabitPillEditor() {
  const { draft, update } = useHabitForm();
  const textColor = useThemeColor({}, 'text');
  const isDark = useColorScheme() !== 'light';
  const [showIcons, setShowIcons] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  // Auto-focus the name only when starting from a blank habit, matching the
  // previous standalone Title field's behavior.
  const [autoFocusName] = useState(() => draft.title.trim().length === 0);

  const color = draft.color ?? Palette.primary;
  const pillBg = solidTint(color, PILL_TINT, isDark);
  const hasIcon = draft.icon.length > 0;

  return (
    <View style={styles.wrap}>
      <View style={[styles.pill, { backgroundColor: pillBg }]}>
        <Pressable
          onPress={() => setShowIcons((s) => !s)}
          accessibilityRole="button"
          accessibilityLabel={hasIcon ? 'Change icon' : 'Add icon'}
          style={[
            styles.leading,
            hasIcon
              ? { backgroundColor: color }
              : { borderWidth: 2, borderColor: color, borderStyle: 'dashed' },
          ]}>
          {hasIcon ? (
            <ThemedText style={styles.emoji}>{draft.icon}</ThemedText>
          ) : (
            <ThemedText style={[styles.plus, { color }]}>+</ThemedText>
          )}
        </Pressable>

        <View style={styles.body}>
          <TextInput
            value={draft.title}
            onChangeText={(t) => update({ title: t })}
            placeholder="Habit name"
            placeholderTextColor="rgba(127,127,127,0.5)"
            style={[styles.title, { color: textColor }]}
            autoFocus={autoFocusName}
            returnKeyType="done"
          />
          <TextInput
            value={draft.description}
            onChangeText={(t) => update({ description: t })}
            placeholder="Add a description"
            placeholderTextColor="rgba(127,127,127,0.5)"
            style={[styles.description, { color: textColor }]}
            returnKeyType="done"
          />
        </View>

        <Pressable
          onPress={() => setColorOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Choose color"
          hitSlop={10}>
          <ColorWheelIcon size={26} />
        </Pressable>
      </View>

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

      <ColorPickerModal
        visible={colorOpen}
        value={color}
        onChange={(hex) => update({ color: hex })}
        onClose={() => setColorOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(127,127,127,0.25)',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
  },
  leading: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 22, textAlign: 'center' },
  plus: { fontSize: 24, fontWeight: '400', lineHeight: 28 },
  body: { flex: 1 },
  title: { fontSize: 16, fontWeight: '600', paddingVertical: 0 },
  description: { fontSize: 13, opacity: 0.7, paddingVertical: 0, marginTop: 2 },
  pickerRow: { paddingRight: 16, gap: 12, alignItems: 'center' },
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
