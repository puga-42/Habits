import {
  mergeUserFeedPages,
  userFeedSortKey,
  friendshipActionLabel,
  filterItemsByLineage,
  filterItemsByDate,
  habitsCompletedOnDate,
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
    flex_position: null,
    flex_target: null,
    event_type: null,
    adopted_from_handle: null,
    habit_description: null,
    habit_lineage_id: 'h1',
    completion_count: 0,
    habit_rrule: null,
    habit_dtstart: null,
    habit_until: null,
    habit_target_period: null,
    completion_history: [],
    skip_history: [],
    streak: 0,
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
    habit_description: null,
    habit_lineage_id: 'h2',
    completion_count: 0,
    habit_rrule: null,
    habit_dtstart: null,
    habit_until: null,
    habit_target_period: null,
    completion_history: [],
    skip_history: [],
    streak: 0,
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

describe('filterItemsByDate', () => {
  it('returns all items when date is null', () => {
    const items = [makeItem({ id: 'a' }), makeItem({ id: 'b' })];
    expect(filterItemsByDate(items, null)).toEqual(items);
  });

  it('filters by occurrence_date for scheduled completions', () => {
    const items = [
      makeItem({ id: 'a', occurrence_date: '2026-06-01' }),
      makeItem({ id: 'b', occurrence_date: '2026-06-02' }),
    ];
    expect(filterItemsByDate(items, '2026-06-01').map((i) => i.id)).toEqual(['a']);
  });

  it('filters by period_start for flex completions', () => {
    const items = [
      makeItem({ id: 'a', occurrence_date: null, period_start: '2026-06-01' }),
      makeItem({ id: 'b', occurrence_date: null, period_start: '2026-06-03' }),
    ];
    expect(filterItemsByDate(items, '2026-06-01').map((i) => i.id)).toEqual(['a']);
  });

  it('falls back to completed_at date for items without occurrence or period', () => {
    const items = [
      makeActivityItem({ id: 'a', completed_at: '2026-06-01T14:00:00Z' }),
    ];
    expect(filterItemsByDate(items, '2026-06-01').map((i) => i.id)).toEqual(['a']);
  });

  it('returns empty array when no items match', () => {
    const items = [makeItem({ id: 'a', occurrence_date: '2026-06-01' })];
    expect(filterItemsByDate(items, '2026-06-05')).toEqual([]);
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

describe('habitsCompletedOnDate', () => {
  const habits: UserHabit[] = [
    { id: 'h1', lineage_id: 'l1', title: 'Meditate', icon: '🧘', color: '#aaa', kind: 'scheduled' },
    { id: 'h2', lineage_id: 'l2', title: 'Run', icon: '🏃', color: '#f00', kind: 'flex' },
    { id: 'h3', lineage_id: 'l3', title: 'Read', icon: '📖', color: '#00f', kind: 'scheduled' },
  ];

  it('returns habits with completions on the given date', () => {
    const items = [
      makeItem({ id: 'c1', habit_id: 'h1', occurrence_date: '2026-06-01' }),
      makeItem({ id: 'c2', habit_id: 'h3', occurrence_date: '2026-06-01' }),
    ];
    const result = habitsCompletedOnDate(items, habits, '2026-06-01');
    expect(result.map((h) => h.id)).toEqual(['h1', 'h3']);
  });

  it('returns empty array when no items match the date', () => {
    const items = [
      makeItem({ id: 'c1', habit_id: 'h1', occurrence_date: '2026-06-02' }),
    ];
    expect(habitsCompletedOnDate(items, habits, '2026-06-01')).toEqual([]);
  });

  it('deduplicates habits with multiple completions', () => {
    const items = [
      makeItem({ id: 'c1', habit_id: 'h1', occurrence_date: '2026-06-01' }),
      makeItem({ id: 'c2', habit_id: 'h1', occurrence_date: '2026-06-01' }),
    ];
    const result = habitsCompletedOnDate(items, habits, '2026-06-01');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('h1');
  });

  it('returns empty array for empty items', () => {
    expect(habitsCompletedOnDate([], habits, '2026-06-01')).toEqual([]);
  });

  it('matches by period_start fallback', () => {
    const items = [
      makeItem({ id: 'c1', habit_id: 'h2', occurrence_date: null, period_start: '2026-06-01' }),
    ];
    const result = habitsCompletedOnDate(items, habits, '2026-06-01');
    expect(result.map((h) => h.id)).toEqual(['h2']);
  });
});
