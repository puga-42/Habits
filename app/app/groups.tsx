// Identities list — every identity the user is building (Atomic Habits:
// habits serve who you're becoming). Reached from the FAB and the menu
// drawer. This is a plain directory: tap a row → that identity's overview
// (/group/[id]) where editing (and deleting, via Edit) lives; "New identity"
// → the creation page. Reloads on focus so edits/creates show on return.

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTokens } from '@/hooks/use-tokens';
import { useAuth } from '@/lib/auth';
import { fetchGroups, fetchMemberships, type HabitGroup } from '@/lib/groups';

export default function GroupsScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;
  const t = useTokens();

  const [groups, setGroups] = useState<HabitGroup[]>([]);
  const [memberCount, setMemberCount] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    const [gs, members] = await Promise.all([
      fetchGroups(userId),
      fetchMemberships(userId).catch(() => []),
    ]);
    const counts = new Map<string, number>();
    for (const m of members) {
      if (m.effective_until == null) counts.set(m.group_id, (counts.get(m.group_id) ?? 0) + 1);
    }
    setGroups(gs);
    setMemberCount(counts);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load().finally(() => setLoading(false));
    }, [load]),
  );

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.content}>
        <View style={[styles.header, { borderBottomColor: t.hairlineStrong }]}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.side}>
            <ThemedText style={[styles.back, { color: t.accent }]}>‹ Back</ThemedText>
          </Pressable>
          <ThemedText type="displaySemiBold">Identities</ThemedText>
          <View style={styles.sideRight} />
        </View>

        <Pressable
          onPress={() => router.push('/group/new')}
          style={({ pressed }) => [
            styles.newRow,
            { borderBottomColor: t.hairlineStrong },
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="New identity">
          <ThemedText style={[styles.newText, { color: t.accent }]}>+ New identity</ThemedText>
        </Pressable>

        {loading ? (
          <ActivityIndicator style={styles.loading} />
        ) : groups.length === 0 ? (
          <ThemedText style={styles.empty}>
            No identities yet. Create one for who you&apos;re becoming — like &ldquo;I am
            fluent in Spanish&rdquo; — and group the habits that get you there.
          </ThemedText>
        ) : (
          <ScrollView contentContainerStyle={styles.list}>
            {groups.map((g) => {
              const n = memberCount.get(g.id) ?? 0;
              return (
                <Pressable
                  key={g.id}
                  onPress={() => router.push(`/group/${g.id}`)}
                  style={({ pressed }) => [
                    styles.row,
                    { borderBottomColor: t.hairlineStrong },
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${g.name}`}>
                  <View style={styles.rowBody}>
                    <ThemedText style={styles.name} numberOfLines={1}>
                      {g.name}
                    </ThemedText>
                    <ThemedText style={[styles.count, { color: t.ink52 }]}>
                      {n} habit{n === 1 ? '' : 's'}
                    </ThemedText>
                  </View>
                  <ThemedText style={[styles.chevron, { color: t.ink45 }]}>›</ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
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
  },
  side: { width: 64 },
  sideRight: { width: 64 },
  back: { fontSize: 16 },
  newRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  newText: { fontSize: 16, fontWeight: '600' },
  pressed: { opacity: 0.5 },
  loading: { marginTop: 32 },
  empty: { padding: 24, opacity: 0.6, fontSize: 15, lineHeight: 21 },
  list: { paddingVertical: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowBody: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600' },
  count: { fontSize: 13, marginTop: 2 },
  chevron: { fontSize: 22 },
});
