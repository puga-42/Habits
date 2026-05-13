import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

type Props = {
  visible: boolean;
  year: number;
  month: number;
  onPick: (year: number, month: number) => void;
  onClose: () => void;
};

export function MonthPicker({ visible, year, month, onPick, onClose }: Props) {
  const [pickerYear, setPickerYear] = useState(year);

  useEffect(() => {
    if (visible) setPickerYear(year);
  }, [visible, year]);

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
            <ThemedText type="defaultSemiBold">Select month</ThemedText>
            <Pressable onPress={onClose} hitSlop={12} style={styles.headerSide}>
              <ThemedText style={styles.done}>Done</ThemedText>
            </Pressable>
          </View>

          <View style={styles.yearRow}>
            <Pressable onPress={() => setPickerYear((y) => y - 1)} hitSlop={16}>
              <ThemedText style={styles.arrow}>‹</ThemedText>
            </Pressable>
            <ThemedText type="title" style={styles.yearText}>
              {pickerYear}
            </ThemedText>
            <Pressable onPress={() => setPickerYear((y) => y + 1)} hitSlop={16}>
              <ThemedText style={styles.arrow}>›</ThemedText>
            </Pressable>
          </View>

          <View style={styles.monthsGrid}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
              const isSelected = pickerYear === year && m === month;
              return (
                <Pressable
                  key={m}
                  onPress={() => onPick(pickerYear, m)}
                  style={({ pressed }) => [
                    styles.monthBtn,
                    isSelected && styles.monthBtnSelected,
                    pressed && styles.monthBtnPressed,
                  ]}>
                  <ThemedText
                    style={[styles.monthBtnText, isSelected && styles.monthBtnTextSelected]}>
                    {monthAbbrev(m)}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </SafeAreaView>
      </ThemedView>
    </Modal>
  );
}

function monthAbbrev(m: number): string {
  return new Date(2026, m - 1, 1).toLocaleDateString('en-US', { month: 'short' });
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
  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
    paddingVertical: 24,
  },
  arrow: { fontSize: 30, opacity: 0.6 },
  yearText: { fontSize: 28 },
  monthsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
  },
  monthBtn: {
    width: '22%',
    paddingVertical: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(127,127,127,0.3)',
    alignItems: 'center',
  },
  monthBtnSelected: {
    backgroundColor: 'rgba(127,127,127,0.25)',
    borderColor: 'rgba(127,127,127,0.6)',
  },
  monthBtnPressed: { opacity: 0.5 },
  monthBtnText: { fontSize: 15 },
  monthBtnTextSelected: { fontWeight: '600' },
});
