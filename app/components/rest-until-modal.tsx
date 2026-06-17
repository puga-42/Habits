// Date picker shown when a habit is rested. The user picks the date they're
// resting *until* (inclusive); the caller neutralizes every due day in
// [from .. until] so the streak survives. Centered-card modal.

import DateTimePicker from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, useColorScheme, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Palette } from '@/constants/colors';
import { isoDate } from '@/lib/habits';

type Props = {
  visible: boolean;
  habitTitle: string;
  fromIso: string;
  onConfirm: (untilIso: string) => void;
  onClose: () => void;
};

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d);
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function RestUntilModal({ visible, habitTitle, fromIso, onConfirm, onClose }: Props) {
  const isDark = useColorScheme() !== 'light';
  const from = parseIso(fromIso);
  const [date, setDate] = useState(() => addDays(from, 7));

  // Default to a week out each time the sheet opens.
  useEffect(() => {
    if (visible) setDate(addDays(parseIso(fromIso), 7));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, fromIso]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.card, { backgroundColor: isDark ? Palette.charcoalElevated : '#FFFFFF' }]}
          onPress={() => {}}>
          <ThemedText style={styles.title} numberOfLines={1}>
            Rest {habitTitle}
          </ThemedText>
          <ThemedText style={styles.subtitle}>Resting until</ThemedText>

          <DateTimePicker
            value={date}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'spinner'}
            minimumDate={from}
            onChange={(_e, d) => d && setDate(d)}
          />

          <View style={styles.actions}>
            <Pressable onPress={onClose} hitSlop={8} style={styles.btn}>
              <ThemedText style={styles.cancel}>Cancel</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => onConfirm(isoDate(date))}
              hitSlop={8}
              style={[styles.btn, styles.restBtn]}>
              <ThemedText style={styles.restText}>Rest</ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
  title: { fontSize: 17, fontWeight: '600' },
  subtitle: {
    fontSize: 12,
    opacity: 0.55,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
  },
  btn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  cancel: { fontSize: 16, opacity: 0.7 },
  restBtn: { backgroundColor: 'rgba(9,237,226,0.18)' },
  restText: { fontSize: 16, fontWeight: '700', color: Palette.primaryDark },
});
