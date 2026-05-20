import {
  mergeUserFeedPages,
  userFeedSortKey,
  friendshipActionLabel,
  filterItemsByLineage,
  type UserHabit,
} from '../user-profile';
import type { FeedItem } from '../feed';

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
    ...overrides,
  };
}

describe('userFeedSortKey', () => {
  it('returns completed_at for completion items', () => {
    const item = makeItem({ completed_at: '2026-05-14T10:00:00Z' });
    expect(userFeedSortKey(item)).toBe('2026-05-14T10:00:00Z');
  });

  it('returns created_at for habit_created items', () => {
    const item = makeActivityItem({ created_at: '2026-05-14T09:00:00Z' });
    expect(userFeedSortKey(item)).toBe('2026-05-14T09:00:00Z');
  });
});

describe('mergeUserFeedPages', () => {
  it('appends next page preserving descending order', () => {
    const existing = [
      makeItem({ id: 'a', completed_at: '2026-05-14T10:00:00Z' }),
    ];
    const next = [
      makeItem({ id: 'b', completed_at: '2026-05-14T09:00:00Z' }),
    ];
    const merged = mergeUserFeedPages(existing, next);
    expect(merged.map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('dedupes by id, preferring the newer copy', () => {
    const existing = [makeItem({ id: 'a', like_count: 1 })];
    const next = [makeItem({ id: 'a', like_count: 5 })];
    const merged = mergeUserFeedPages(existing, next);
    expect(merged).toHaveLength(1);
    expect(merged[0].like_count).toBe(5);
  });

  it('interleaves completions and activities by sort key', () => {
    const existing = [
      makeItem({
        id: 'c1',
        completed_at: '2026-05-14T10:00:00Z',
        created_at: '2026-05-14T10:00:00Z',
      }),
    ];
    const next = [
      makeActivityItem({ id: 'a1', created_at: '2026-05-14T09:30:00Z' }),
      makeItem({
        id: 'c2',
        completed_at: '2026-05-14T09:00:00Z',
        created_at: '2026-05-14T09:00:00Z',
      }),
    ];
    const merged = mergeUserFeedPages(existing, next);
    expect(merged.map((i) => i.id)).toEqual(['c1', 'a1', 'c2']);
  });

  it('handles empty pages', () => {
    expect(mergeUserFeedPages([], [])).toEqual([]);
    const items = [makeItem({ id: 'a' })];
    expect(mergeUserFeedPages(items, [])).toEqual(items);
    expect(mergeUserFeedPages([], items)).toEqual(items);
  });
});

describe('filterItemsByLineage', () => {
  const habits: UserHabit[] = [
    { id: 'h1', lineage_id: 'L1', title: 'Meditate', icon: '🧘', color: null, kind: 'scheduled' },
    { id: 'h2', lineage_id: 'L1', title: 'Meditate v2', icon: '🧘', color: null, kind: 'scheduled' },
    { id: 'h3', lineage_id: 'L2', title: 'Run', icon: '🏃', color: null, kind: 'flex' },
  ];

  it('returns all items when lineageId is null', () => {
    const items = [makeItem({ id: 'a', habit_id: 'h1' }), makeItem({ id: 'b', habit_id: 'h3' })];
    expect(filterItemsByLineage(items, habits, null)).toEqual(items);
  });

  it('filters to items whose habit belongs to the given lineage', () => {
    const items = [
      makeItem({ id: 'a', habit_id: 'h1' }),
      makeItem({ id: 'b', habit_id: 'h3' }),
      makeItem({ id: 'c', habit_id: 'h2' }),
    ];
    const result = filterItemsByLineage(items, habits, 'L1');
    expect(result.map((i) => i.id)).toEqual(['a', 'c']);
  });

  it('returns empty array when no items match', () => {
    const items = [makeItem({ id: 'a', habit_id: 'h3' })];
    expect(filterItemsByLineage(items, habits, 'L1')).toEqual([]);
  });

  it('handles empty items', () => {
    expect(filterItemsByLineage([], habits, 'L1')).toEqual([]);
  });

  it('handles unknown lineage gracefully', () => {
    const items = [makeItem({ id: 'a', habit_id: 'h1' })];
    expect(filterItemsByLineage(items, habits, 'L_unknown')).toEqual([]);
  });
});

describe('friendshipActionLabel', () => {
  it('returns correct label for each status', () => {
    expect(friendshipActionLabel('none')).toBe('Add friend');
    expect(friendshipActionLabel('pending_outgoing')).toBe('Request sent');
    expect(friendshipActionLabel('pending_incoming')).toBe('Accept');
    expect(friendshipActionLabel('friend')).toBe('Friends');
  });

  it('returns null for self', () => {
    expect(friendshipActionLabel('self')).toBeNull();
  });
});
