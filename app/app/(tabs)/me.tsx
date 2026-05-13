import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/lib/auth';

export default function MeScreen() {
  const { session, signOut } = useAuth();
  const email = session?.user?.email ?? 'unknown';

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.content}>
        <ThemedText type="title">Me</ThemedText>
        <ThemedText style={styles.placeholder}>
          Your profile, habits, and recent activity.
        </ThemedText>
        <View style={styles.section}>
          <ThemedText type="defaultSemiBold">Signed in as</ThemedText>
          <ThemedText style={styles.muted}>{email}</ThemedText>
        </View>
        <Pressable onPress={signOut} style={styles.button}>
          <ThemedText type="defaultSemiBold" style={styles.buttonText}>
            Sign out
          </ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 16, gap: 16 },
  placeholder: { opacity: 0.6, marginTop: 8 },
  section: { gap: 4, marginTop: 24 },
  muted: { opacity: 0.6, fontSize: 14 },
  button: {
    marginTop: 32,
    borderWidth: 1,
    borderColor: 'rgba(127,127,127,0.4)',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  buttonText: { fontSize: 15 },
});
