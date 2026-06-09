import {
  notificationMessage,
  type AppNotification,
  type NotificationKind,
} from '../notifications';

function makeNotification(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: 'n1',
    kind: 'completion_like',
    actor_id: 'u2',
    actor_handle: 'alice',
    actor_avatar_url: null,
    target_id: 'c1',
    comment_id: null,
    habit_title: 'Meditate',
    read: false,
    created_at: '2026-06-07T10:00:00Z',
    ...overrides,
  };
}

describe('notificationMessage', () => {
  it('formats completion_like', () => {
    const n = makeNotification({ kind: 'completion_like' });
    expect(notificationMessage(n)).toBe('liked your Meditate completion');
  });

  it('formats completion_comment', () => {
    const n = makeNotification({ kind: 'completion_comment' });
    expect(notificationMessage(n)).toBe('commented on your Meditate completion');
  });

  it('formats comment_like', () => {
    const n = makeNotification({ kind: 'comment_like' });
    expect(notificationMessage(n)).toBe('liked your comment');
  });

  it('formats activity_like', () => {
    const n = makeNotification({ kind: 'activity_like' });
    expect(notificationMessage(n)).toBe('liked your Meditate');
  });

  it('formats activity_comment', () => {
    const n = makeNotification({ kind: 'activity_comment' });
    expect(notificationMessage(n)).toBe('commented on your Meditate');
  });

  it('formats activity_comment_like', () => {
    const n = makeNotification({ kind: 'activity_comment_like' });
    expect(notificationMessage(n)).toBe('liked your comment');
  });

  it('handles missing habit_title gracefully', () => {
    const n = makeNotification({ kind: 'completion_like', habit_title: '' });
    expect(notificationMessage(n)).toBe('liked your completion');
  });

  it('formats habit_adopted with title', () => {
    const n = makeNotification({ kind: 'habit_adopted', habit_title: 'Yoga' });
    expect(notificationMessage(n)).toBe('adopted your habit Yoga');
  });

  it('formats habit_adopted without title', () => {
    const n = makeNotification({ kind: 'habit_adopted', habit_title: '' });
    expect(notificationMessage(n)).toBe('adopted your habit');
  });
});
