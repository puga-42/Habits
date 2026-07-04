// "Alerts" detail page (pushed from the habit form's Alerts row). Manages the
// habit's reminder times: a list of alert times with per-row remove, plus an
// "Add alert" row opening a native time picker. Grouped iOS-style, mirroring
// the Goal / Repeat / Visibility pages. Reads/writes the shared draft; the
// notification permission is requested the moment the user adds a time.

import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CardList, FormCard } from '@/components/form-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Palette } from '@/constants/colors';
import { ensureAlertPermissions } from '@/lib/alert-scheduler';
import { formatAlertTime, normalizeAlertTimes } from '@/lib/alerts';
import { useHabitForm } from '@/lib/habit-form';
import { formatTime } from '@/lib/habits';

export default function AlertsScreen() {
  const router = useRouter();
  const { draft, update } = useHabitForm();
  const [showPicker, setShowPicker] = useState(false);
  // Staged picker value so iOS's spinning wheel doesn't commit every tick.
  const [pickerValue, setPickerValue] = useState(() => {
    const d = new Date();
    d.setSeconds(0, 0);
    return d;
  });

  async function addTime(time: string) {
    const granted = await ensureAlertPermissions();
    if (!granted) {
      Alert.alert(
        'Notifications are off',
        'To get habit alerts, allow notifications for Habits in system Settings.',
      );
      return;
    }
    update({ alertTimes: normalizeAlertTimes([...draft.alertTimes, time]) });
  }

  function removeTime(time: string) {
    update({ alertTimes: draft.alertTimes.filter((t) => t !== time) });
  }

  function handlePicked(e: DateTimePickerEvent, date?: Date) {
    if (Platform.OS === 'android') {
      setShowPicker(false);
      if (e.type !== 'set' || !date) return;
      addTime(formatTime(date));
      return;
    }
    if (date) setPickerValue(date);
  }

  function confirmAdd() {
    setShowPicker(false);
    addTime(formatTime(pickerValue));
  }

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ThemedText style={styles.headerButton}>‹ Back</ThemedText>
          </Pressable>
          <ThemedText type="defaultSemiBold">Alerts</ThemedText>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ThemedText style={[styles.headerButton, styles.done]}>Done</ThemedText>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <FormCard title="Alerts">
            <CardList>
              {draft.alertTimes.map((time) => (
                <View key={time} style={styles.row}>
                  <ThemedText style={styles.rowLabel}>{formatAlertTime(time)}</ThemedText>
                  <Pressable onPress={() => removeTime(time)} hitSlop={8}>
                    <ThemedText style={styles.remove}>Remove</ThemedText>
                  </Pressable>
                </View>
              ))}
              {draft.alertTimes.length === 0 && !showPicker && (
                <View style={styles.row}>
                  <ThemedText style={styles.empty}>
                    No alerts — you won’t be reminded about this habit.
                  </ThemedText>
                </View>
              )}
              {showPicker && Platform.OS !== 'android' && (
                <View style={styles.pickerRow}>
                  <DateTimePicker
                    value={pickerValue}
                    mode="time"
                    display="spinner"
                    onChange={handlePicked}
                  />
                  <Pressable onPress={confirmAdd} style={styles.addConfirm}>
                    <ThemedText style={styles.addConfirmText}>Add this alert</ThemedText>
                  </Pressable>
                </View>
              )}
              <Pressable style={styles.row} onPress={() => setShowPicker(true)}>
                <ThemedText style={styles.add}>+ Add alert</ThemedText>
              </Pressable>
            </CardList>
          </FormCard>
          {showPicker && Platform.OS === 'android' && (
            <DateTimePicker
              value={pickerValue}
              mode="time"
              display="default"
              onChange={handlePicked}
            />
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
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
  headerButton: { fontSize: 16 },
  done: { fontWeight: '600' },
  scroll: { padding: 20, paddingBottom: 60, gap: 24 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowLabel: { fontSize: 16 },
  remove: { fontSize: 14, color: '#ef4444' },
  empty: { fontSize: 14, opacity: 0.55 },
  add: { fontSize: 16, color: Palette.primary, fontWeight: '600' },
  pickerRow: { paddingHorizontal: 16, paddingBottom: 8, alignItems: 'center' },
  addConfirm: { paddingVertical: 10 },
  addConfirmText: { fontSize: 16, color: Palette.primary, fontWeight: '600' },
});
