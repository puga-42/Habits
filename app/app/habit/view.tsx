import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/lib/auth';
import { fetchHabit, type Habit, type Visibility } from '@/lib/habits';
import { describeRrule, parseRrule } from '@/lib/recurrence';

const VISIBILITY_LABELS: Record<Visibility, string> = {
  public: 'Public',
  friends: 'Friends only',
  private: 'Private',
};

export default function HabitViewScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { id, occurrenceDate } = useLocalSearchParams<{
    id: string;
    occurrenceDate?: string;
  }>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [habit, setHabit] = useState<Habit | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetchHabit(id)
      .then(setHabit)
      .catch((err) => {
        Alert.alert('Could not load habit', err instanceof Error ? err.message : String(err));
      })
      .finally(() => setLoading(false));
  }, [id]);

  const isOwner = habit?.owner_id === session?.user.id;

  const handleEdit = useCallback(() => {
    if (!habit) return;
    if (occurrenceDate) {
      router.push({ pathname: '/habit/[id]', params: { id: habit.id, occurrenceDate } });
    } else {
      router.push({ pathname: '/habit/[id]', params: { id: habit.id } });
    }
  }, [habit, occurrenceDate, router]);

  if (loading || !habit) {
    return (
      <ThemedView style={styles.root}>
        <SafeAreaView edges={['top']} style={[styles.content, styles.centered]}>
          <ActivityIndicator />
        </SafeAreaView>
      </ThemedView>
    );
  }

  const scheduleLabel =
    habit.kind === 'scheduled' && habit.rrule
      ? describeRrule(parseRrule(habit.rrule))
      : habit.kind === 'flex'
        ? `${habit.target_count}× per ${habit.target_period}`
        : null;

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ThemedText style={styles.headerButton}>Close</ThemedText>
          </Pressable>
          <ThemedText type="defaultSemiBold" numberOfLines={1} style={styles.headerTitle}>
            {habit.title}
          </ThemedText>
          {isOwner ? (
            <Pressable onPress={handleEdit} hitSlop={12}>
              <ThemedText style={[styles.headerButton, styles.editButton]}>Edit</ThemedText>
            </Pressable>
          ) : (
            <View style={styles.headerPlaceholder} />
          )}
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.heroRow}>
            {habit.icon && <ThemedText type="icon" style={styles.heroIcon}>{habit.icon}</ThemedText>}
            <View style={styles.heroText}>
              <ThemedText type="title" style={styles.title}>
                {habit.title}
              </ThemedText>
              {habit.description ? (
                <ThemedText style={styles.description}>{habit.description}</ThemedText>
              ) : null}
            </View>
          </View>

          <View style={styles.detailSection}>
            <DetailRow label="Type" value={habit.kind === 'scheduled' ? 'Scheduled' : 'Flexible'} />
            {scheduleLabel && <DetailRow label="Schedule" value={scheduleLabel} />}
            <DetailRow label="Visibility" value={VISIBILITY_LABELS[habit.visibility]} />
            {habit.color && (
              <View style={styles.detailRow}>
                <ThemedText style={styles.detailLabel}>Color</ThemedText>
                <View style={[styles.colorSwatch, { backgroundColor: habit.color }]} />
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <ThemedText style={styles.detailLabel}>{label}</ThemedText>
      <ThemedText style={styles.detailValue}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(127,127,127,0.25)',
  },
  headerButton: { fontSize: 16 },
  headerTitle: { flex: 1, textAlign: 'center', marginHorizontal: 8 },
  editButton: { fontWeight: '600', color: '#7c3aed' },
  headerPlaceholder: { width: 40 },
  scroll: { padding: 20 },
  heroRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  heroIcon: { fontSize: 40, marginRight: 14 },
  heroText: { flex: 1 },
  title: { fontSize: 24 },
  description: { fontSize: 15, marginTop: 4, opacity: 0.7 },
  detailSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(127,127,127,0.2)',
    paddingTop: 16,
    gap: 14,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: { fontSize: 15, opacity: 0.6 },
  detailValue: { fontSize: 15, fontWeight: '500' },
  colorSwatch: { width: 20, height: 20, borderRadius: 10 },
});
