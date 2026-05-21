import { SafeAreaView } from 'react-native-safe-area-context';

import { useDrawer } from '@/components/drawer-provider';
import { TabTopBar } from '@/components/tab-top-bar';
import { ThemedView } from '@/components/themed-view';
import { UserProfileView } from '@/components/user-profile-view';
import { useAuth } from '@/lib/auth';

export default function MeScreen() {
  const { session } = useAuth();
  const { openDrawer } = useDrawer();
  const viewerId = session?.user.id ?? '';

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <TabTopBar title="Me" onMenuPress={openDrawer} />
        <UserProfileView targetId={viewerId} viewerId={viewerId} />
      </SafeAreaView>
    </ThemedView>
  );
}
