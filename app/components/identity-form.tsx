// Shared form body for the identity create (/group/new) and edit
// (/group/edit) pages: name + description fields and the habit checklist.
// Presentational — the screens own state, save/create/delete mutations, and
// pass extras (e.g. the edit page's Delete button) as children below.

import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { GroupEditDetails } from '@/components/group-edit-details';
import { GroupEditHabitRow } from '@/components/group-edit-habit-row';
import { ThemedText } from '@/components/themed-text';
import { Palette } from '@/constants/colors';
import { useTokens } from '@/hooks/use-tokens';
import type { GroupHabitChoice } from '@/lib/group-edit';

type Props = {
  name: string;
  description: string;
  color: string | null;
  choices: GroupHabitChoice[];
  selected: Set<string>;
  emptyCopy: string;
  onChangeName: (s: string) => void;
  onChangeDescription: (s: string) => void;
  onChangeColor: (color: string | null) => void;
  onToggle: (lineageId: string) => void;
  children?: ReactNode;
};

export function IdentityForm({
  name,
  description,
  color,
  choices,
  selected,
  emptyCopy,
  onChangeName,
  onChangeDescription,
  onChangeColor,
  onToggle,
  children,
}: Props) {
  const t = useTokens();
  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets>
      <GroupEditDetails
        name={name}
        description={description}
        textColor={t.ink}
        onChangeName={onChangeName}
        onChangeDescription={onChangeDescription}
      />

      {/* Identity color tints the day-view card (a softer wash than habit
          pills, so the two schemes don't compete). Garden swatches only —
          "None" keeps the plain surface. */}
      <ThemedText style={styles.label}>Color</ThemedText>
      <View style={styles.swatches}>
        <Pressable
          onPress={() => onChangeColor(null)}
          accessibilityRole="button"
          accessibilityState={{ selected: color === null }}
          accessibilityLabel="No color"
          style={[
            styles.swatch,
            { borderColor: color === null ? t.ink : t.hairlineStrong },
          ]}>
          <View style={[styles.noneSlash, { backgroundColor: t.ink45 }]} />
        </Pressable>
        {Palette.habitColors.map((c) => {
          const isSelected = color?.toUpperCase() === c.toUpperCase();
          return (
            <Pressable
              key={c}
              onPress={() => onChangeColor(c)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`Color ${c}`}
              style={[
                styles.swatch,
                { backgroundColor: c, borderColor: isSelected ? t.ink : 'transparent' },
                isSelected && styles.swatchSelected,
              ]}
            />
          );
        })}
      </View>

      <ThemedText style={styles.label}>Habits</ThemedText>
      {choices.length === 0 ? (
        <ThemedText style={styles.empty}>{emptyCopy}</ThemedText>
      ) : (
        choices.map((choice) => (
          <GroupEditHabitRow
            key={choice.lineageId}
            choice={choice}
            selected={selected.has(choice.lineageId)}
            onToggle={() => onToggle(choice.lineageId)}
          />
        ))
      )}

      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, paddingBottom: 48 },
  label: {
    fontSize: 12,
    opacity: 0.55,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 20,
    marginBottom: 6,
  },
  empty: { opacity: 0.6, fontSize: 15, lineHeight: 21, paddingVertical: 8 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchSelected: { transform: [{ scale: 1.1 }] },
  noneSlash: { width: 18, height: 2, borderRadius: 1, transform: [{ rotate: '-45deg' }] },
});
