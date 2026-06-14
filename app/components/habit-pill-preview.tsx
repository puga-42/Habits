// Pinned, read-only preview of how the habit will look on the calendar. Mirrors
// the visual language of `AgendaRow` (tinted pill, colored icon circle, title +
// description, completion marker). It reads the shared habit draft and updates
// live as the user edits the Name / Description / Icon / Color fields below it
// (see HabitIdentityFields) — the pill itself is not editable.

import { StyleSheet, useColorScheme, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Palette, solidTint } from '@/constants/colors';
import { useHabitForm } from '@/lib/habit-form';

const PILL_TINT = 0.22;

export function HabitPillPreview() {
  const { draft } = useHabitForm();
  const isDark = useColorScheme() !== 'light';

  const color = draft.color ?? Palette.primary;
  const pillBg = solidTint(color, PILL_TINT, isDark);
  const hasIcon = draft.icon.length > 0;
  const hasDescription = draft.description.trim().length > 0;

  return (
    <View style={styles.wrap}>
      <View style={[styles.pill, { backgroundColor: pillBg }]}>
        <View
          style={[
            styles.leading,
            hasIcon
              ? { backgroundColor: color }
              : { borderWidth: 2, borderColor: color, borderStyle: 'dashed' },
          ]}>
          {hasIcon && <ThemedText style={styles.emoji}>{draft.icon}</ThemedText>}
        </View>

        <View style={styles.body}>
          <ThemedText
            style={[styles.title, draft.title.length === 0 && styles.placeholder]}
            numberOfLines={1}>
            {draft.title.length > 0 ? draft.title : 'Habit name'}
          </ThemedText>
          {hasDescription && (
            <ThemedText style={styles.description} numberOfLines={2}>
              {draft.description}
            </ThemedText>
          )}
        </View>

        <View style={[styles.marker, { borderColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
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
  body: { flex: 1 },
  title: { fontSize: 16, fontWeight: '600' },
  placeholder: { opacity: 0.4 },
  description: { fontSize: 13, opacity: 0.7, marginTop: 2 },
  marker: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
  },
});
