// Empty state for the Feed tab when the viewer has no friends and no own
// completions yet. Single CTA to find friends.

import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTokens } from '@/hooks/use-tokens';

export function FeedEmpty() {
  const t = useTokens();
  const router = useRouter();
  return (
    <View style={styles.root}>
      <ThemedText type="defaultSemiBold" style={styles.title}>
        Your feed is quiet
      </ThemedText>
      <ThemedText style={styles.body}>
        Complete a habit or add friends, and you&apos;ll see it here.
      </ThemedText>
      <Pressable
        onPress={() => router.push('/(tabs)/friends')}
        style={({ pressed }) => [
          styles.cta,
          { backgroundColor: t.accentSoft },
          pressed && styles.ctaPressed,
        ]}>
        <ThemedText style={[styles.ctaText, { color: t.accent }]}>Find friends</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingTop: 80,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 8,
  },
  title: { fontSize: 18 },
  body: { opacity: 0.6, textAlign: 'center', marginBottom: 14 },
  cta: {
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 22,
  },
  ctaPressed: { opacity: 0.6 },
  ctaText: { fontSize: 15, fontWeight: '600' },
});
