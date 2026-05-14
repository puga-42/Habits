import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/lib/auth';
import {
  WEEKDAY_NAMES,
  fetchProfile,
  updateWeekStart,
  weekdayName,
  type Profile,
} from '@/lib/profile';

export default function MeScreen() {
  const { session, signOut } = useAuth();
  const email = session?.user?.email ?? 'unknown';
  const [profile, setProfile] = useState<Profile | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const load = useCallback(async () => {
    if (!session?.user.id) return;
    try {
      const p = await fetchProfile(session.user.id);
      setProfile(p);
    } catch (err) {
      console.warn('Failed to load profile', err);
    }
  }, [session?.user.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function onPickWeekStart(value: number) {
    if (!session?.user.id || !profile) return;
    // Optimistic update
    setProfile({ ...profile, week_start: value });
    try {
      await updateWeekStart(session.user.id, value);
    } catch (err) {
      // Revert on failure
      setProfile(profile);
      Alert.alert('Could not save', err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.content}>
        <ThemedText type="title">Me</ThemedText>

        <View style={styles.section}>
          <ThemedText type="defaultSemiBold">Signed in as</ThemedText>
          <ThemedText style={styles.muted}>{email}</ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Calendar</ThemedText>
          <Pressable
            onPress={() => setPickerOpen(true)}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
            <ThemedText style={styles.rowLabel}>Week starts on</ThemedText>
            <ThemedText style={styles.rowValue}>
              {profile ? weekdayName(profile.week_start) : '…'}
            </ThemedText>
          </Pressable>
        </View>

        <Pressable onPress={signOut} style={styles.signOut}>
          <ThemedText type="defaultSemiBold" style={styles.signOutText}>
            Sign out
          </ThemedText>
        </Pressable>
      </SafeAreaView>

      <WeekStartPicker
        visible={pickerOpen}
        value={profile?.week_start ?? 0}
        onPick={(v) => {
          onPickWeekStart(v);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </ThemedView>
  );
}

function WeekStartPicker({
  visible,
  value,
  onPick,
  onClose,
}: {
  visible: boolean;
  value: number;
  onPick: (v: number) => void;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <ThemedView style={pickerStyles.root}>
        <SafeAreaView edges={['top']} style={pickerStyles.content}>
          <View style={pickerStyles.header}>
            <View style={pickerStyles.headerSide} />
            <ThemedText type="defaultSemiBold">Week starts on</ThemedText>
            <Pressable onPress={onClose} hitSlop={12} style={pickerStyles.headerSide}>
              <ThemedText style={pickerStyles.done}>Done</ThemedText>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={pickerStyles.list}>
            {WEEKDAY_NAMES.map((name, i) => (
              <Pressable
                key={i}
                onPress={() => onPick(i)}
                style={({ pressed }) => [
                  pickerStyles.option,
                  pressed && pickerStyles.optionPressed,
                ]}>
                <ThemedText style={pickerStyles.radio}>
                  {value === i ? '●' : '○'}
                </ThemedText>
                <ThemedText style={pickerStyles.optionLabel}>{name}</ThemedText>
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
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 16, gap: 16 },
  section: { gap: 4, marginTop: 24 },
  sectionTitle: {
    fontSize: 12,
    opacity: 0.55,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  muted: { opacity: 0.6, fontSize: 14 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(127,127,127,0.25)',
  },
  rowPressed: { opacity: 0.5 },
  rowLabel: { fontSize: 16 },
  rowValue: { fontSize: 15, opacity: 0.65 },
  signOut: {
    marginTop: 32,
    borderWidth: 1,
    borderColor: 'rgba(127,127,127,0.4)',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  signOutText: { fontSize: 15 },
});

const pickerStyles = StyleSheet.create({
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
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  optionPressed: { opacity: 0.5 },
  radio: { fontSize: 18, width: 24 },
  optionLabel: { fontSize: 16 },
});
