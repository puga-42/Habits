import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import {
  pickAndUpload,
  removeAttachment,
  reorderCompletionAttachments,
} from '@/lib/attachment-actions';
import { updateNote } from '@/lib/completions';
import { signedUrlsForPaths } from '@/lib/feed';
import {
  currentPeriodStart,
  fetchHabitCompletions,
  resolveEffectiveNote,
  type OverviewCompletion,
} from '@/lib/habit-overview';
import {
  canCompleteOn,
  fetchHabit,
  isoDate,
  markFlexCompleted,
  markScheduledCompleted,
  unmarkCompleted,
  type Habit,
} from '@/lib/habits';
import { syncWidgetData } from '@/lib/widget-sync';

export type HabitOverviewState = {
  habit: Habit | null;
  completions: OverviewCompletion[];
  signedUrls: Map<string, string>;
  loading: boolean;
  busy: boolean;
  expandedId: string | null;
  activeIndex: number;
  isOwner: boolean;
  canComplete: boolean;
  setExpandedId: (id: string | null) => void;
  setActiveIndex: (index: number) => void;
  handleIncrement: () => void;
  handleDecrement: () => void;
  handleNoteSave: (completionId: string, note: string | null) => void;
  handleAttachmentAdd: (completionId: string) => void;
  handleAttachmentDelete: (completionId: string, attachmentId: string) => void;
  handleAttachmentReorder: (completionId: string, ids: string[]) => void;
  effectiveNote: (completion: OverviewCompletion) => string | null;
  flushPendingChanges: () => Promise<void>;
};

export function useHabitOverview(
  habitId: string | undefined,
  userId: string | undefined,
  dateParam: string | undefined,
): HabitOverviewState {
  const [habit, setHabit] = useState<Habit | null>(null);
  const [completions, setCompletions] = useState<OverviewCompletion[]>([]);
  const [signedUrls, setSignedUrls] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const pendingNotes = useRef(new Map<string, string | null>());

  const dateIso = dateParam ?? isoDate(new Date());
  const isOwner = habit?.owner_id === userId;
  const canComplete = isOwner && canCompleteOn(dateIso, new Date());

  const loadCompletions = useCallback(
    async (h: Habit) => {
      const occDate = h.kind === 'scheduled' ? dateIso : null;
      const perStart =
        h.kind === 'flex' && h.target_period
          ? currentPeriodStart(dateIso, h.target_period)
          : null;
      const list = await fetchHabitCompletions(h.id, occDate, perStart);
      setCompletions(list);
      setActiveIndex(0);
      pendingNotes.current.clear();
      if (list.length > 0) setExpandedId(list[0].id);
      const paths = list.flatMap((c) => c.attachments.map((a) => a.storage_path));
      if (paths.length > 0) {
        const urls = await signedUrlsForPaths(paths);
        setSignedUrls((prev) => {
          const next = new Map(prev);
          for (const [k, v] of urls) next.set(k, v);
          return next;
        });
      }
    },
    [dateIso],
  );

  useEffect(() => {
    if (!habitId) return;
    fetchHabit(habitId)
      .then((h) => {
        setHabit(h);
        return loadCompletions(h);
      })
      .catch((err) => {
        Alert.alert('Could not load habit', err instanceof Error ? err.message : String(err));
      })
      .finally(() => setLoading(false));
  }, [habitId, loadCompletions]);

  const handleIncrement = useCallback(async () => {
    if (!habit || !userId || busy) return;
    setBusy(true);
    try {
      if (habit.kind === 'scheduled') {
        await markScheduledCompleted(habit.id, userId, dateIso);
      } else {
        await markFlexCompleted(habit.id, userId);
      }
      await loadCompletions(habit);
      syncWidgetData(userId);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [habit, userId, dateIso, busy, loadCompletions]);

  const handleDecrement = useCallback(async () => {
    if (!habit || !userId || busy || completions.length === 0) return;
    setBusy(true);
    try {
      await unmarkCompleted(completions[0].id);
      await loadCompletions(habit);
      syncWidgetData(userId);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [habit, userId, busy, completions, loadCompletions]);

  const handleNoteSave = useCallback(
    (completionId: string, note: string | null) => {
      pendingNotes.current.set(completionId, note);
    },
    [],
  );

  const effectiveNote = useCallback(
    (completion: OverviewCompletion): string | null =>
      resolveEffectiveNote(pendingNotes.current, completion),
    [],
  );

  const flushPendingChanges = useCallback(async () => {
    const entries = Array.from(pendingNotes.current.entries());
    pendingNotes.current.clear();
    await Promise.all(
      entries.map(([completionId, note]) => updateNote(completionId, note)),
    );
  }, []);

  const handleAttachmentAdd = useCallback(
    async (completionId: string) => {
      if (!userId) return;
      setBusy(true);
      try {
        await pickAndUpload(completionId, userId, completions, setCompletions, setSignedUrls);
      } catch (err) {
        Alert.alert('Upload failed', err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [userId, completions],
  );

  const handleAttachmentDelete = useCallback(
    (completionId: string, attachmentId: string) => {
      removeAttachment(completionId, attachmentId, setCompletions);
    },
    [],
  );

  const handleAttachmentReorder = useCallback(
    (completionId: string, orderedIds: string[]) => {
      reorderCompletionAttachments(completionId, orderedIds, setCompletions);
    },
    [],
  );

  return {
    habit,
    completions,
    signedUrls,
    loading,
    busy,
    expandedId,
    activeIndex,
    isOwner,
    canComplete,
    setExpandedId,
    setActiveIndex,
    handleIncrement,
    handleDecrement,
    handleNoteSave,
    handleAttachmentAdd,
    handleAttachmentDelete,
    handleAttachmentReorder,
    effectiveNote,
    flushPendingChanges,
  };
}
