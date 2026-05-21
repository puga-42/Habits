import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HandleEditor, WeekStartPicker } from '@/components/settings-modals';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/lib/auth';
import {
  fetchProfile,
  updateHandle,
  updateWeekStart,
  weekdayName,
  type Profile,
} from '@/lib/profile';

export default function SettingsScreen() {
  const { session, signOut } = useAuth();
  const router = useRouter();
  const email = session?.user?.email ?? 'unknown';
  const [profile, setProfile] = useState<Profile | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [handleEditorOpen, setHandleEditorOpen] = useState(false);

  const load = useCallback(async () => {
    if (!session?.user.id) return;
    try {
      const p = await fetchProfile(session.user.id);
      setProfile(p);
    } catch (err) {
      console.warn('Failed to load profile', err);
    }
  }, [session?.user.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function onSaveHandle(newHandle: string) {
    if (!session?.user.id || !profile) return;
    const prev = profile;
    setProfile({ ...profile, handle: newHandle.trim() });
    try {
      await updateHandle(session.user.id, newHandle);
    } catch (err) {
      setProfile(prev);
      Alert.alert('Could not save', err instanceof Error ? err.message : String(err));
    }
  }

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

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ThemedText style={styles.back}>‹ Back</ThemedText>
          </Pressable>
          <ThemedText type="title">Settings</ThemedText>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.section}>
          <ThemedText type="defaultSemiBold">Signed in as</ThemedText>
          <ThemedText style={styles.muted}>{email}</ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Profile</ThemedText>
          <Pressable
            onPress={() => setHandleEditorOpen(true)}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
            <ThemedText style={styles.rowLabel}>Handle</ThemedText>
            <ThemedText style={styles.rowValue}>
              {profile ? `@${profile.handle}` : '…'}
            </ThemedText>
          </Pressable>
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
        onPick={(v) => { onPickWeekStart(v); setPickerOpen(false); }}
        onClose={() => setPickerOpen(false)}
      />
      <HandleEditor
        visible={handleEditorOpen}
        currentHandle={profile?.handle ?? ''}
        onSave={(h) => { onSaveHandle(h); setHandleEditorOpen(false); }}
        onClose={() => setHandleEditorOpen(false)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 16, gap: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  back: { fontSize: 18, opacity: 0.85 },
  headerSpacer: { flex: 1 },
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
