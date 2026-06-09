import {
  applyCommentLikeToggle,
  applyLikeToggle,
  feedItemSortKey,
  formatRelativeTime,
  mergeFeedPages,
  parseLikerKind,
  type Comment,
  type FeedItem,
} from '../feed';

function makeItem(overrides: Partial<FeedItem> = {}): FeedItem {
  return {
    id: 'c1',
    habit_id: 'h1',
    owner_id: 'u1',
    feed_kind: 'completion',
    occurrence_date: '2026-05-14',
    period_start: null,
    completed_at: '2026-05-14T07:00:00Z',
    created_at: '2026-05-14T07:00:00Z',
    note: null,
    visibility_override: null,
    owner_handle: 'maya_b',
    owner_avatar_url: null,
    habit_title: 'Meditate',
    habit_icon: '🧘',
    habit_color: '#aaa',
    habit_kind: 'scheduled',
    attachments: [],
    like_count: 0,
    comment_count: 0,
    viewer_liked: false,
    flex_position: null,
    flex_target: null,
    event_type: null,
    adopted_from_handle: null,
    ...overrides,
  };
}

function makeActivityItem(overrides: Partial<FeedItem> = {}): FeedItem {
  return {
    id: 'a1',
    habit_id: 'h2',
    owner_id: 'u2',
    feed_kind: 'habit_created',
    occurrence_date: null,
    period_start: null,
    completed_at: null,
    created_at: '2026-05-14T09:00:00Z',
    note: null,
    visibility_override: null,
    owner_handle: 'tomc',
    owner_avatar_url: null,
    habit_title: 'Run',
    habit_icon: '🏃',
    habit_color: '#f00',
    habit_kind: 'flex',
    attachments: [],
    like_count: 0,
    comment_count: 0,
    viewer_liked: false,
    flex_position: null,
    flex_target: null,
    event_type: 'created',
    adopted_from_handle: null,
    ...overrides,
  };
}

function makeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: 'cm1',
    completion_id: 'c1',
    author_id: 'u2',
    author_handle: 'tomc',
    author_avatar_url: null,
    body: 'nice',
    created_at: '2026-05-14T08:00:00Z',
    updated_at: '2026-05-14T08:00:00Z',
    like_count: 0,
    viewer_liked: false,
    ...overrides,
  };
}

describe('formatRelativeTime', () => {
  const now = new Date('2026-05-14T12:00:00Z');

  it('returns "just now" within 60 seconds', () => {
    expect(formatRelativeTime('2026-05-14T11:59:30Z', now)).toBe('just now');
  });

  it('returns "Nm" for minutes', () => {
    expect(formatRelativeTime('2026-05-14T11:55:00Z', now)).toBe('5m');
    expect(formatRelativeTime('2026-05-14T11:01:00Z', now)).toBe('59m');
  });

  it('returns "Nh" for hours within the same day', () => {
    expect(formatRelativeTime('2026-05-14T09:00:00Z', now)).toBe('3h');
    expect(formatRelativeTime('2026-05-14T01:00:00Z', now)).toBe('11h');
  });

  it('returns "yesterday" for ~24h ago', () => {
    expect(formatRelativeTime('2026-05-13T12:00:00Z', now)).toBe('yesterday');
  });

  it('returns weekday for within the last week', () => {
    // 2026-05-10 was a Sunday
    expect(formatRelativeTime('2026-05-10T12:00:00Z', now)).toBe('Sun');
  });

  it('returns an explicit date when older than a week', () => {
    expect(formatRelativeTime('2026-04-30T12:00:00Z', now)).toBe('Apr 30');
  });
});

describe('mergeFeedPages', () => {
  it('appends the next page to the end', () => {
    const existing = [makeItem({ id: 'a', completed_at: '2026-05-14T10:00:00Z' })];
    const next = [makeItem({ id: 'b', completed_at: '2026-05-14T09:00:00Z' })];
    const merged = mergeFeedPages(existing, next);
    expect(merged.map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('dedupes by id, preferring the newer copy (from `next`)', () => {
    const existing = [makeItem({ id: 'a', like_count: 1 })];
    const next = [makeItem({ id: 'a', like_count: 5 })];
    const merged = mergeFeedPages(existing, next);
    expect(merged).toHaveLength(1);
    expect(merged[0].like_count).toBe(5);
  });

  it('preserves descending completed_at order', () => {
    const existing = [
      makeItem({ id: 'a', completed_at: '2026-05-14T10:00:00Z' }),
      makeItem({ id: 'b', completed_at: '2026-05-14T08:00:00Z' }),
    ];
    const next = [
      makeItem({ id: 'c', completed_at: '2026-05-14T09:00:00Z' }),
      makeItem({ id: 'd', completed_at: '2026-05-14T07:00:00Z' }),
    ];
    const merged = mergeFeedPages(existing, next);
    expect(merged.map((i) => i.id)).toEqual(['a', 'c', 'b', 'd']);
  });
});

describe('applyLikeToggle', () => {
  it('toggling on increments like_count and sets viewer_liked', () => {
    const item = makeItem({ like_count: 3, viewer_liked: false });
    const result = applyLikeToggle(item, true);
    expect(result.like_count).toBe(4);
    expect(result.viewer_liked).toBe(true);
  });

  it('toggling off decrements like_count and clears viewer_liked', () => {
    const item = makeItem({ like_count: 3, viewer_liked: true });
    const result = applyLikeToggle(item, false);
    expect(result.like_count).toBe(2);
    expect(result.viewer_liked).toBe(false);
  });

  it('is idempotent when already in the target state', () => {
    const liked = makeItem({ like_count: 1, viewer_liked: true });
    expect(applyLikeToggle(liked, true)).toEqual(liked);
    const unliked = makeItem({ like_count: 0, viewer_liked: false });
    expect(applyLikeToggle(unliked, false)).toEqual(unliked);
  });

  it('never drives like_count below zero', () => {
    const item = makeItem({ like_count: 0, viewer_liked: false });
    const result = applyLikeToggle(item, false);
    expect(result.like_count).toBe(0);
  });
});

describe('applyCommentLikeToggle', () => {
  it('toggling on increments like_count and sets viewer_liked', () => {
    const c = makeComment({ like_count: 2, viewer_liked: false });
    const result = applyCommentLikeToggle(c, true);
    expect(result.like_count).toBe(3);
    expect(result.viewer_liked).toBe(true);
  });

  it('toggling off decrements like_count and clears viewer_liked', () => {
    const c = makeComment({ like_count: 2, viewer_liked: true });
    const result = applyCommentLikeToggle(c, false);
    expect(result.like_count).toBe(1);
    expect(result.viewer_liked).toBe(false);
  });

  it('is idempotent when already in the target state', () => {
    const liked = makeComment({ like_count: 1, viewer_liked: true });
    expect(applyCommentLikeToggle(liked, true)).toEqual(liked);
  });
});

describe('feedItemSortKey', () => {
  it('returns completed_at for completion items', () => {
    const item = makeItem({ completed_at: '2026-05-14T10:00:00Z' });
    expect(feedItemSortKey(item)).toBe('2026-05-14T10:00:00Z');
  });

  it('returns created_at for habit_created items', () => {
    const item = makeActivityItem({ created_at: '2026-05-14T09:00:00Z' });
    expect(feedItemSortKey(item)).toBe('2026-05-14T09:00:00Z');
  });
});

describe('mergeFeedPages (mixed kinds)', () => {
  it('interleaves completions and activities by sort key', () => {
    const existing = [
      makeItem({ id: 'c1', completed_at: '2026-05-14T10:00:00Z', created_at: '2026-05-14T10:00:00Z' }),
    ];
    const next = [
      makeActivityItem({ id: 'a1', created_at: '2026-05-14T09:30:00Z' }),
      makeItem({ id: 'c2', completed_at: '2026-05-14T09:00:00Z', created_at: '2026-05-14T09:00:00Z' }),
    ];
    const merged = mergeFeedPages(existing, next);
    expect(merged.map((i) => i.id)).toEqual(['c1', 'a1', 'c2']);
  });

  it('dedupes activity items by id just like completions', () => {
    const existing = [makeActivityItem({ id: 'a1', like_count: 0 })];
    const next = [makeActivityItem({ id: 'a1', like_count: 3 })];
    const merged = mergeFeedPages(existing, next);
    expect(merged).toHaveLength(1);
    expect(merged[0].like_count).toBe(3);
  });
});

describe('applyLikeToggle on activity items', () => {
  it('toggles like on an activity item', () => {
    const item = makeActivityItem({ like_count: 1, viewer_liked: false });
    const result = applyLikeToggle(item, true);
    expect(result.like_count).toBe(2);
    expect(result.viewer_liked).toBe(true);
  });
});

describe('parseLikerKind', () => {
  it('returns "completion" for "completion"', () => {
    expect(parseLikerKind('completion')).toBe('completion');
  });

  it('returns "comment" for "comment"', () => {
    expect(parseLikerKind('comment')).toBe('comment');
  });

  it('returns "activity" for "activity"', () => {
    expect(parseLikerKind('activity')).toBe('activity');
  });

  it('defaults to "completion" for unknown strings', () => {
    expect(parseLikerKind('garbage')).toBe('completion');
    expect(parseLikerKind('')).toBe('completion');
  });
});
