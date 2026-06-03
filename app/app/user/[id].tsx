import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UserProfileView } from '@/components/user-profile-view';
import { useAuth } from '@/lib/auth';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const viewerId = session?.user.id ?? '';

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={s.bar}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={s.side}>
            <ThemedText style={s.backIcon}>‹</ThemedText>
          </Pressable>
          <View style={s.titleWrap}>
            <ThemedText type="defaultSemiBold" style={s.title} numberOfLines={1}>
              Profile
            </ThemedText>
          </View>
          <View style={s.sideRight} />
        </View>
        <UserProfileView targetId={id} viewerId={viewerId} onBack={() => router.back()} />
      </SafeAreaView>
    </ThemedView>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  side: { width: 80, alignItems: 'flex-start' },
  sideRight: { width: 80, alignItems: 'flex-end' },
  backIcon: { fontSize: 28, paddingHorizontal: 6, paddingVertical: 4 },
  titleWrap: { flex: 1, alignItems: 'center' },
  title: { fontSize: 18 },
});
