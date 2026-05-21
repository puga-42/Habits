import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

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
        <UserProfileView targetId={id} viewerId={viewerId} onBack={() => router.back()} />
      </SafeAreaView>
    </ThemedView>
  );
}
