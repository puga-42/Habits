import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/lib/auth';
import { bulkUpdateHabitVisibility } from '@/lib/habits';
import {
  WEEKDAY_NAMES,
  fetchProfile,
  updateDefaultVisibility,
  updateWeekStart,
  weekdayName,
  type Profile,
} from '@/lib/profile';
import type { Visibility } from '@/lib/habits';

const VISIBILITY_OPTIONS: { value: Visibility; label: string }[] = [
  { value: 'public', label: 'Public — anyone can see' },
  { value: 'friends', label: 'Friends — only your friends' },
  { value: 'private', label: 'Private — only you' },
];

export default function MeScreen() {
  const { session, signOut } = useAuth();
  const email = session?.user?.email ?? 'unknown';
  const [profile, setProfile] = useState<Profile | null>(null);
  const [weekPickerOpen, setWeekPickerOpen] = useState(false);
  const [visPickerOpen, setVisPickerOpen] = useState(false);

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
    setProfile({ ...profile, week_start: value });
    try {
      await updateWeekStart(session.user.id, value);
    } catch (err) {
      setProfile(profile);
      Alert.alert('Could not save', err instanceof Error ? err.message : String(err));
    }
  }

  async function onPickDefaultVisibility(value: Visibility, applyToAll: boolean) {
    if (!session?.user.id || !profile) return;
    const prev = profile;
    setProfile({ ...profile, default_visibility: value });
    try {
      await updateDefaultVisibility(session.user.id, value);
      if (applyToAll) {
        await bulkUpdateHabitVisibility(session.user.id, value);
      }
    } catch (err) {
      setProfile(prev);
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
          {profile && (
            <ThemedText style={styles.handle}>@{profile.handle}</ThemedText>
          )}
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Calendar</ThemedText>
          <Pressable
            onPress={() => setWeekPickerOpen(true)}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
            <ThemedText style={styles.rowLabel}>Week starts on</ThemedText>
            <ThemedText style={styles.rowValue}>
              {profile ? weekdayName(profile.week_start) : '…'}
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Habits</ThemedText>
          <Pressable
            onPress={() => setVisPickerOpen(true)}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
            <ThemedText style={styles.rowLabel}>Default visibility</ThemedText>
            <ThemedText style={styles.rowValue}>
              {profile
                ? VISIBILITY_OPTIONS.find((o) => o.value === profile.default_visibility)
                    ?.label.split(' — ')[0] ?? '…'
                : '…'}
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
        visible={weekPickerOpen}
        value={profile?.week_start ?? 0}
        onPick={(v) => {
          onPickWeekStart(v);
          setWeekPickerOpen(false);
        }}
        onClose={() => setWeekPickerOpen(false)}
      />

      <DefaultVisibilityPicker
        visible={visPickerOpen}
        value={profile?.default_visibility ?? 'public'}
        onPick={(v, applyToAll) => {
          onPickDefaultVisibility(v, applyToAll);
          setVisPickerOpen(false);
        }}
        onClose={() => setVisPickerOpen(false)}
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

function DefaultVisibilityPicker({
  visible,
  value,
  onPick,
  onClose,
}: {
  visible: boolean;
  value: Visibility;
  onPick: (v: Visibility, applyToAll: boolean) => void;
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
            <ThemedText type="defaultSemiBold">Default visibility</ThemedText>
            <Pressable onPress={onClose} hitSlop={12} style={pickerStyles.headerSide}>
              <ThemedText style={pickerStyles.done}>Done</ThemedText>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={pickerStyles.list}>
            {VISIBILITY_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => onPick(opt.value, false)}
                style={({ pressed }) => [
                  pickerStyles.option,
                  pressed && pickerStyles.optionPressed,
                ]}>
                <ThemedText style={pickerStyles.radio}>
                  {value === opt.value ? '●' : '○'}
                </ThemedText>
                <ThemedText style={pickerStyles.optionLabel}>{opt.label}</ThemedText>
              </Pressable>
            ))}
            <View style={pickerStyles.divider} />
            <Pressable
              onPress={() => onPick(value, true)}
              style={({ pressed }) => [
                pickerStyles.applyAll,
                pressed && pickerStyles.optionPressed,
              ]}>
              <ThemedText style={pickerStyles.applyAllText}>
                Apply to all existing habits
              </ThemedText>
            </Pressable>
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
  handle: { opacity: 0.5, fontSize: 14, marginTop: 2 },
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
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(127,127,127,0.25)',
    marginHorizontal: 20,
    marginVertical: 8,
  },
  applyAll: { paddingVertical: 14, paddingHorizontal: 20 },
  applyAllText: { fontSize: 16, color: '#7c3aed', fontWeight: '500' },
});
