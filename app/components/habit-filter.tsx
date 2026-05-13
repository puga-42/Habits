import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import type { Habit } from '@/lib/habits';

type Props = {
  visible: boolean;
  habits: Habit[];
  selectedHabitId: string | null;
  onPick: (habitId: string | null) => void;
  onClose: () => void;
};

export function HabitFilter({ visible, habits, selectedHabitId, onPick, onClose }: Props) {
  function choose(id: string | null) {
    onPick(id);
    onClose();
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <ThemedView style={styles.root}>
        <SafeAreaView edges={['top']} style={styles.content}>
          <View style={styles.header}>
            <View style={styles.headerSide} />
            <ThemedText type="defaultSemiBold">Filter</ThemedText>
            <Pressable onPress={onClose} hitSlop={12} style={styles.headerSide}>
              <ThemedText style={styles.done}>Done</ThemedText>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.list}>
            <Pressable onPress={() => choose(null)} style={styles.row}>
              <ThemedText style={styles.radio}>{selectedHabitId === null ? '●' : '○'}</ThemedText>
              <ThemedText style={styles.title}>All habits</ThemedText>
            </Pressable>
            {habits.map((h) => (
              <Pressable key={h.id} onPress={() => choose(h.id)} style={styles.row}>
                <ThemedText style={styles.radio}>
                  {selectedHabitId === h.id ? '●' : '○'}
                </ThemedText>
                <View
                  style={[
                    styles.swatch,
                    h.color ? { backgroundColor: h.color } : styles.swatchFallback,
                  ]}
                />
                <ThemedText style={styles.title} numberOfLines={1}>
                  {h.icon ? `${h.icon}  ` : ''}
                  {h.title}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>
        </SafeAreaView>
      </ThemedView>
    </Modal>
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
  headerSide: { width: 60 },
  done: { fontSize: 16, fontWeight: '600', textAlign: 'right' },
  list: { paddingVertical: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  radio: { fontSize: 18, width: 24 },
  swatch: { width: 8, height: 24, borderRadius: 2 },
  swatchFallback: { backgroundColor: 'rgba(127,127,127,0.4)' },
  title: { flex: 1, fontSize: 16 },
});
