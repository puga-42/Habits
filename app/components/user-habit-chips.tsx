import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Palette } from '@/constants/colors';
import type { UserHabit } from '@/lib/user-profile';

type Props = {
  habits: UserHabit[];
  selectedLineageId: string | null;
  onSelect: (lineageId: string | null) => void;
};

export function UserHabitChips({ habits, selectedLineageId, onSelect }: Props) {
  if (habits.length === 0) return null;

  const allSelected = selectedLineageId === null;

  return (
    <View style={styles.root}>
      <ThemedText style={styles.label}>
        {habits.length} {habits.length === 1 ? 'habit' : 'habits'}
      </ThemedText>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={habits}
        keyExtractor={(h) => h.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Pressable
            onPress={() => onSelect(null)}
            style={[styles.chip, allSelected && styles.chipSelected]}>
            <ThemedText
              style={[
                styles.chipText,
                allSelected && styles.chipTextSelected,
              ]}>
              All
            </ThemedText>
          </Pressable>
        }
        renderItem={({ item }) => {
          const selected =
            !allSelected && item.lineage_id === selectedLineageId;
          return (
            <Pressable
              onPress={() => onSelect(item.lineage_id)}
              style={[
                styles.chip,
                selected && styles.chipSelected,
                item.color
                  ? { borderColor: item.color }
                  : undefined,
              ]}>
              {item.icon ? (
                <ThemedText style={styles.chipIcon}>{item.icon}</ThemedText>
              ) : null}
              <ThemedText
                style={[
                  styles.chipText,
                  selected && styles.chipTextSelected,
                ]}
                numberOfLines={1}>
                {item.title}
              </ThemedText>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 6 },
  label: {
    fontSize: 12,
    opacity: 0.55,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 14,
  },
  list: { paddingHorizontal: 14, gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(127,127,127,0.25)',
    backgroundColor: 'rgba(127,127,127,0.06)',
  },
  chipSelected: {
    backgroundColor: 'rgba(10,126,164,0.15)',
    borderColor: Palette.primary,
  },
  chipIcon: { fontSize: 14 },
  chipText: { fontSize: 13, fontWeight: '500', maxWidth: 120 },
  chipTextSelected: { fontWeight: '700' },
});
