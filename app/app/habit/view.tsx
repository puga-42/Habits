import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CompletionCardStack } from '@/components/completion-card-stack';
import { CompletionCounter } from '@/components/completion-counter';
import {
  CompletionInlineEditor,
  DisabledEditorPlaceholder,
} from '@/components/completion-inline-editor';
import { FeedAvatar } from '@/components/feed-avatar';
import { HabitCompletionChart } from '@/components/habit-completion-chart';
import { OverviewSocial } from '@/components/overview-social';
import { StopwatchPanel } from '@/components/stopwatch-panel';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Palette } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { useHabitForm } from '@/lib/habit-form';
import { currentPeriodStart } from '@/lib/habit-overview';
import { isoDate } from '@/lib/habits';
import { useHabitOverview } from '@/lib/use-habit-overview';

export default function HabitViewScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { id, occurrenceDate, completionId, activityId } = useLocalSearchParams<{
    id: string;
    occurrenceDate?: string;
    completionId?: string;
    activityId?: string;
  }>();

  const navigation = useNavigation();
  const { seedFromHabit, update } = useHabitForm();
  const state = useHabitOverview(id, session?.user.id, occurrenceDate, completionId, activityId);
  const { habit, completions, signedUrls, loading, busy } = state;
  const { expandedId, setExpandedId, isOwner, canComplete } = state;
  const { activeIndex, setActiveIndex, effectiveNote, flushPendingChanges } = state;
  const { ownerProfile, socialTarget, activeSocial } = state;
  const { handleToggleLike, handleCommentCountChange } = state;

  const handleClose = useCallback(async () => {
    await flushPendingChanges();
    router.back();
  }, [flushPendingChanges, router]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', () => {
      flushPendingChanges();
    });
    return unsubscribe;
  }, [navigation, flushPendingChanges]);

  const handleEdit = useCallback(() => {
    if (!habit) return;
    if (occurrenceDate) {
      router.push({ pathname: '/habit/[id]', params: { id: habit.id, occurrenceDate } });
    } else {
      router.push({ pathname: '/habit/[id]', params: { id: habit.id } });
    }
  }, [habit, occurrenceDate, router]);

  const handleAdopt = useCallback(() => {
    if (!habit) return;
    seedFromHabit(habit);
    update({ adoptedFromUserId: habit.owner_id });
    router.push('/habit/new');
  }, [habit, seedFromHabit, update, router]);

  if (loading || !habit) {
    return (
      <ThemedView style={styles.root}>
        <SafeAreaView edges={['top']} style={[styles.content, styles.centered]}>
          <ActivityIndicator />
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={handleClose} hitSlop={12}>
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
            <Pressable onPress={handleAdopt} hitSlop={12}>
              <ThemedText style={[styles.headerButton, styles.adoptButton]}>Adopt</ThemedText>
            </Pressable>
          )}
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable
            style={styles.ownerRow}
            onPress={() => router.push(`/user/${habit.owner_id}`)}
            hitSlop={6}
          >
            <FeedAvatar
              url={ownerProfile?.avatar_url ?? null}
              handle={ownerProfile?.handle ?? ''}
              size={40}
              tintColor={habit.color ?? undefined}
            />
            <ThemedText style={styles.ownerHandle} numberOfLines={1}>
              @{ownerProfile?.handle ?? '…'}
            </ThemedText>
          </Pressable>

          <View style={styles.titleBlock}>
            <ThemedText type="title" style={styles.title}>{habit.title}</ThemedText>
            {habit.description ? (
              <ThemedText style={styles.description}>{habit.description}</ThemedText>
            ) : null}
          </View>

          {isOwner &&
            (habit.unit === 'time' && session?.user.id ? (
              <StopwatchPanel
                habit={habit}
                userId={session.user.id}
                occurrenceDate={habit.kind === 'scheduled' ? (occurrenceDate ?? isoDate(new Date())) : null}
                periodStart={
                  habit.kind === 'flex' && habit.target_period
                    ? currentPeriodStart(occurrenceDate ?? isoDate(new Date()), habit.target_period)
                    : null
                }
                isAlreadyComplete={completions.length > 0}
              />
            ) : (
              <CompletionCounter
                habit={habit}
                completionCount={completions.length}
                onIncrement={state.handleIncrement}
                onDecrement={state.handleDecrement}
                disabled={!canComplete}
                busy={busy}
              />
            ))}

          {completions.length > 0 ? (
            habit.kind === 'flex' && completions.length > 1 ? (
              <CompletionCardStack
                completions={completions}
                signedUrls={signedUrls}
                editable={isOwner}
                activeIndex={activeIndex}
                onChangeIndex={setActiveIndex}
                effectiveNote={effectiveNote}
                onNoteSave={state.handleNoteSave}
                onAttachmentAdd={state.handleAttachmentAdd}
                onAttachmentDelete={state.handleAttachmentDelete}
                onAttachmentReorder={state.handleAttachmentReorder}
              />
            ) : isOwner ||
              completions[0].note ||
              completions[0].attachments.length > 0 ? (
              <View style={styles.completionsSection}>
                {completions.map((c) => (
                  <CompletionInlineEditor
                    key={c.id}
                    completion={c}
                    signedUrls={signedUrls}
                    editable={isOwner}
                    expanded={c.id === expandedId}
                    onToggle={() =>
                      setExpandedId(expandedId === c.id ? null : c.id)
                    }
                    onNoteSave={state.handleNoteSave}
                    onAttachmentAdd={state.handleAttachmentAdd}
                    onAttachmentDelete={state.handleAttachmentDelete}
                    onAttachmentReorder={state.handleAttachmentReorder}
                  />
                ))}
              </View>
            ) : null
          ) : (
            isOwner && <DisabledEditorPlaceholder />
          )}

          {socialTarget ? (
            <OverviewSocial
              targetKind={socialTarget.kind}
              targetId={socialTarget.id}
              targetOwnerId={socialTarget.ownerId}
              social={activeSocial}
              onToggleLike={handleToggleLike}
              onCommentCountChange={handleCommentCountChange}
            />
          ) : null}

          {session?.user.id ? (
            <HabitCompletionChart habit={habit} viewerId={session.user.id} />
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
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
  editButton: { fontWeight: '600', color: Palette.primary },
  adoptButton: { fontWeight: '600', color: Palette.primary },
  scroll: { padding: 20, paddingBottom: 40 },
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  ownerHandle: { fontSize: 15, fontWeight: '600' },
  titleBlock: { alignItems: 'flex-start', marginBottom: 12 },
  title: { fontSize: 24 },
  description: { fontSize: 15, marginTop: 4, opacity: 0.7 },
  completionsSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(127,127,127,0.2)',
    paddingTop: 12,
    gap: 8,
  },
});
