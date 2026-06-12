import { useCallback, useEffect, useState } from 'react';

import {
  fetchActivitySocial,
  fetchCompletionSocial,
  likeActivity,
  likeCompletion,
  toggleSocialLike,
  unlikeActivity,
  unlikeCompletion,
  type FeedKind,
  type SocialCounts,
} from '@/lib/feed';

const EMPTY_SOCIAL: SocialCounts = {
  like_count: 0,
  comment_count: 0,
  viewer_liked: false,
};

export type SocialTarget = { kind: FeedKind; id: string };

export type SocialTargetState = {
  social: SocialCounts;
  handleToggleLike: () => void;
  handleCommentCountChange: (delta: number) => void;
};

// Likes/comments for the active social target on the habit overview — either a
// completion or a "started habit" activity. Counts are fetched once per id
// (cached for the session); the like toggle is optimistic and reverts on
// failure. Mirrors the feed's like handling in app/(tabs)/feed.tsx.
export function useSocialTarget(
  target: SocialTarget | null,
  userId: string | undefined,
): SocialTargetState {
  const [byId, setById] = useState<Map<string, SocialCounts>>(new Map());
  const id = target?.id ?? null;
  const kind = target?.kind ?? null;

  useEffect(() => {
    if (!id || !kind || !userId || byId.has(id)) return;
    let cancelled = false;
    const fetch = kind === 'completion' ? fetchCompletionSocial : fetchActivitySocial;
    fetch(id, userId)
      .then((s) => {
        if (!cancelled) setById((prev) => new Map(prev).set(id, s));
      })
      .catch(() => {
        /* non-fatal: the bar shows zero counts until next load */
      });
    return () => {
      cancelled = true;
    };
  }, [id, kind, userId, byId]);

  const handleToggleLike = useCallback(async () => {
    if (!id || !kind || !userId) return;
    const current = byId.get(id) ?? EMPTY_SOCIAL;
    const next = !current.viewer_liked;
    setById((prev) => new Map(prev).set(id, toggleSocialLike(current, next)));
    try {
      const like = kind === 'completion' ? likeCompletion : likeActivity;
      const unlike = kind === 'completion' ? unlikeCompletion : unlikeActivity;
      if (next) await like(id, userId);
      else await unlike(id, userId);
    } catch {
      setById((prev) => new Map(prev).set(id, current));
    }
  }, [id, kind, userId, byId]);

  const handleCommentCountChange = useCallback(
    (delta: number) => {
      if (!id) return;
      setById((prev) => {
        const cur = prev.get(id) ?? EMPTY_SOCIAL;
        return new Map(prev).set(id, {
          ...cur,
          comment_count: Math.max(0, cur.comment_count + delta),
        });
      });
    },
    [id],
  );

  const social = (id && byId.get(id)) || EMPTY_SOCIAL;

  return { social, handleToggleLike, handleCommentCountChange };
}
