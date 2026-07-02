// Group overview — read-only detail for a single group. Reached by tapping a
// group's day-view card header or a row on the /groups manage screen. Shows the
// group identity, description, metrics, the member habits, and a photo mosaic of
// recent member-completion media. Editing routes to the /groups manage screen
// (view-only here). Data + derivations live in lib/use-group-overview.ts.

import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GroupOverviewHeader } from '@/components/group-overview-header';
import { StreakBadge } from '@/components/streak-badge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/lib/auth';
import { useGroupOverview, type GroupMember } from '@/lib/use-group-overview';

export default function GroupOverviewScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const state = useGroupOverview(id, session?.user.id);
  const { group, members, memberCount, streak, completions, photoUrls, loading } =
    state;

  function openMember(member: GroupMember) {
    router.push({ pathname: '/habit/view', params: { id: member.habit.id } });
  }

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.content}>
        <View style={styles.bar}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ThemedText style={styles.back}>‹ Back</ThemedText>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator />
          </View>
        ) : !group ? (
          <View style={styles.centered}>
            <ThemedText style={styles.missing}>This group no longer exists.</ThemedText>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scroll}>
            <GroupOverviewHeader
              name={group.name}
              color={group.color}
              icon={group.icon}
              description={group.description}
              streak={streak}
              memberCount={memberCount}
              completions={completions}
              photoUrls={photoUrls}
              onEdit={() => router.push('/groups')}
            />

            <View style={styles.section}>
              <ThemedText style={styles.sectionLabel}>Habits</ThemedText>
              {members.length === 0 ? (
                <ThemedText style={styles.empty}>
                  No habits in this group yet. Add one from a habit&apos;s Group field.
                </ThemedText>
              ) : (
                members.map((member) => (
                  <Pressable
                    key={member.habit.id}
                    onPress={() => openMember(member)}
                    style={styles.memberRow}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${member.habit.title}`}>
                    <View
                      style={[
                        styles.dot,
                        { backgroundColor: member.habit.color ?? 'rgba(127,127,127,0.5)' },
                      ]}
                    />
                    <View style={styles.memberBody}>
                      <ThemedText style={styles.memberName} numberOfLines={1}>
                        {member.habit.icon ? `${member.habit.icon}  ` : ''}
                        {member.habit.title}
                      </ThemedText>
                      <ThemedText style={styles.memberMeta}>
                        {member.count} completion{member.count === 1 ? '' : 's'}
                      </ThemedText>
                    </View>
                    {member.streak > 0 ? <StreakBadge streak={member.streak} /> : null}
                    <ThemedText style={styles.chevron}>›</ThemedText>
                  </Pressable>
                ))
              )}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
  bar: { paddingHorizontal: 12, paddingVertical: 10 },
  back: { fontSize: 16, color: '#0A84FF' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  missing: { opacity: 0.6, fontSize: 15 },
  scroll: { paddingBottom: 48 },
  section: { paddingHorizontal: 16, paddingTop: 24, gap: 4 },
  sectionLabel: {
    fontSize: 12,
    opacity: 0.55,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  empty: { opacity: 0.6, fontSize: 15, lineHeight: 21, paddingVertical: 8 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(127,127,127,0.2)',
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  memberBody: { flex: 1 },
  memberName: { fontSize: 16, fontWeight: '600' },
  memberMeta: { fontSize: 13, opacity: 0.55, marginTop: 2 },
  chevron: { fontSize: 22, opacity: 0.3 },
});
