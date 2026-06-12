import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";

import {
  pickAndUpload,
  removeAttachment,
  reorderCompletionAttachments,
} from "@/lib/attachment-actions";
import { updateNote } from "@/lib/completions";
import {
  fetchHabitStats,
  habitStreak,
  type HabitStats,
} from "@/lib/habit-stats";
import {
  signedUrlsForPaths,
  type FeedKind,
  type SocialCounts,
} from "@/lib/feed";
import { consumeNavHabit } from "@/lib/habit-nav-cache";
import { fetchProfile } from "@/lib/profile";
import { useSocialTarget, type SocialTarget } from "@/lib/use-social-target";
import {
  currentPeriodStart,
  fetchHabitCompletions,
  resolveEffectiveNote,
  type OverviewCompletion,
} from "@/lib/habit-overview";
import {
  canCompleteOn,
  fetchHabit,
  isoDate,
  markFlexCompleted,
  markScheduledCompleted,
  unmarkCompleted,
  type Habit,
} from "@/lib/habits";
import { syncWidgetData } from "@/lib/widget-sync";

export type OwnerProfile = { handle: string; avatar_url: string | null };

// The completion or activity whose likes/comments the overview's social bar
// acts on. ownerId is the habit owner (= the comment sheet's target owner).
export type OverviewSocialTarget = {
  kind: FeedKind;
  id: string;
  ownerId: string;
};

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
  // Lineage-wide, cadence-aware current streak (matches the feed's).
  streak: number;
  ownerProfile: OwnerProfile | null;
  socialTarget: OverviewSocialTarget | null;
  activeSocial: SocialCounts;
  handleToggleLike: () => void;
  handleCommentCountChange: (delta: number) => void;
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
  completionId?: string,
  activityId?: string,
): HabitOverviewState {
  const [cachedHabit] = useState(() => consumeNavHabit());
  const [habit, setHabit] = useState<Habit | null>(cachedHabit);
  const [completions, setCompletions] = useState<OverviewCompletion[]>([]);
  const [signedUrls, setSignedUrls] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(!cachedHabit);
  const [busy, setBusy] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [ownerProfile, setOwnerProfile] = useState<OwnerProfile | null>(null);
  const [stats, setStats] = useState<HabitStats | null>(null);
  const pendingNotes = useRef(new Map<string, string | null>());
  const now = useRef(new Date()).current;

  const dateIso = dateParam ?? isoDate(new Date());
  const isOwner = habit?.owner_id === userId;
  const streak = useMemo(
    () => (habit && stats ? habitStreak(habit, stats, now) : 0),
    [habit, stats, now],
  );
  const canComplete = isOwner && canCompleteOn(dateIso, new Date());
  const activeCompletion = completions[activeIndex] ?? completions[0] ?? null;
  // Navigating from a "started habit" activity card targets that activity;
  // otherwise the bar acts on the active completion.
  const socialTargetRef: SocialTarget | null = activityId
    ? { kind: "habit_created", id: activityId }
    : activeCompletion
      ? { kind: "completion", id: activeCompletion.id }
      : null;
  const {
    social: activeSocial,
    handleToggleLike,
    handleCommentCountChange,
  } = useSocialTarget(socialTargetRef, userId);
  const socialTarget: OverviewSocialTarget | null =
    socialTargetRef && habit
      ? { ...socialTargetRef, ownerId: habit.owner_id }
      : null;

  const loadCompletions = useCallback(
    async (h: Habit) => {
      const occDate = h.kind === "scheduled" ? dateIso : null;
      const perStart =
        h.kind === "flex" && h.target_period
          ? currentPeriodStart(dateIso, h.target_period)
          : null;
      const list = await fetchHabitCompletions(h.id, occDate, perStart);
      setCompletions(list);
      setActiveIndex(
        completionId
          ? Math.max(
              0,
              list.findIndex((c) => c.id === completionId),
            )
          : 0,
      );
      pendingNotes.current.clear();
      if (list.length > 0) setExpandedId(list[0].id);
      const paths = list.flatMap((c) =>
        c.attachments.map((a) => a.storage_path),
      );
      if (paths.length > 0) {
        const urls = await signedUrlsForPaths(paths);
        setSignedUrls((prev) => {
          const next = new Map(prev);
          for (const [k, v] of urls) next.set(k, v);
          return next;
        });
      }
    },
    [dateIso, completionId],
  );

  // Lineage stats (count + streak inputs). Non-fatal: on any failure the badges
  // are simply hidden. Re-run after each completion mutation so the numbers move
  // with the user's actions.
  const loadStats = useCallback(
    async (h: Habit) => {
      if (!userId) return;
      try {
        setStats(await fetchHabitStats(h.owner_id, userId, h.lineage_id));
      } catch {
        /* non-fatal */
      }
    },
    [userId],
  );

  useEffect(() => {
    if (!habitId) return;
    const loadAll = cachedHabit
      ? loadCompletions(cachedHabit).then(() => loadStats(cachedHabit))
      : fetchHabit(habitId).then((h) => {
          setHabit(h);
          return loadCompletions(h).then(() => loadStats(h));
        });
    loadAll
      .catch((err) => {
        Alert.alert(
          "Could not load habit",
          err instanceof Error ? err.message : String(err),
        );
      })
      .finally(() => setLoading(false));
  }, [habitId, cachedHabit, loadCompletions, loadStats]);

  // Owner identity for the avatar + handle block.
  useEffect(() => {
    const ownerId = habit?.owner_id;
    if (!ownerId) return;
    let cancelled = false;
    fetchProfile(ownerId)
      .then((p) => {
        if (!cancelled)
          setOwnerProfile({ handle: p.handle, avatar_url: p.avatar_url });
      })
      .catch(() => {
        /* non-fatal: the avatar block falls back to an initial bubble */
      });
    return () => {
      cancelled = true;
    };
  }, [habit?.owner_id]);

  const handleIncrement = useCallback(async () => {
    if (!habit || !userId || busy) return;
    setBusy(true);
    try {
      if (habit.kind === "scheduled") {
        await markScheduledCompleted(habit.id, userId, dateIso);
      } else {
        await markFlexCompleted(habit.id, userId);
      }
      await loadCompletions(habit);
      loadStats(habit);
      syncWidgetData(userId);
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [habit, userId, dateIso, busy, loadCompletions, loadStats]);

  const handleDecrement = useCallback(async () => {
    if (!habit || !userId || busy || completions.length === 0) return;
    setBusy(true);
    try {
      await unmarkCompleted(completions[0].id);
      await loadCompletions(habit);
      loadStats(habit);
      syncWidgetData(userId);
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [habit, userId, busy, completions, loadCompletions, loadStats]);

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
        await pickAndUpload(
          completionId,
          userId,
          completions,
          setCompletions,
          setSignedUrls,
        );
      } catch (err) {
        Alert.alert(
          "Upload failed",
          err instanceof Error ? err.message : String(err),
        );
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
    streak,
    ownerProfile,
    socialTarget,
    activeSocial,
    handleToggleLike,
    handleCommentCountChange,
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
