import { supabase } from './supabase';

// ─── Types ─────────────────────────────────────────────────────────────────

export type NotificationKind =
  | 'completion_like'
  | 'completion_comment'
  | 'comment_like'
  | 'activity_like'
  | 'activity_comment'
  | 'activity_comment_like'
  | 'habit_adopted'
  | 'rest_like'
  | 'rest_comment'
  | 'rest_comment_like'
  | 'friend_request'
  | 'friend_request_accepted';

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  actor_id: string;
  actor_handle: string;
  actor_avatar_url: string | null;
  target_id: string;
  comment_id: string | null;
  habit_title: string;
  read: boolean;
  created_at: string;
};

export type NotificationCursor = { created_at: string; id: string };

// ─── Pure helpers ──────────────────────────────────────────────────────────

export function notificationMessage(n: AppNotification): string {
  const title = n.habit_title || '';

  switch (n.kind) {
    case 'completion_like':
      return title ? `liked your ${title} completion` : 'liked your completion';
    case 'completion_comment':
      return title
        ? `commented on your ${title} completion`
        : 'commented on your completion';
    case 'comment_like':
    case 'activity_comment_like':
    case 'rest_comment_like':
      return 'liked your comment';
    case 'activity_like':
      return title ? `liked your ${title}` : 'liked your habit';
    case 'activity_comment':
      return title ? `commented on your ${title}` : 'commented on your habit';
    case 'habit_adopted':
      return title ? `adopted your habit ${title}` : 'adopted your habit';
    case 'rest_like':
      return title ? `liked your ${title} rest` : 'liked your rest';
    case 'rest_comment':
      return title ? `commented on your ${title} rest` : 'commented on your rest';
    case 'friend_request':
      return 'sent you a friend request';
    case 'friend_request_accepted':
      return 'accepted your friend request';
  }
}

// ─── Queries ───────────────────────────────────────────────────────────────

export async function fetchNotifications(
  cursor?: NotificationCursor,
  limit = 30,
): Promise<AppNotification[]> {
  const { data, error } = await supabase.rpc('fetch_notifications_page', {
    cursor_created_at: cursor?.created_at ?? null,
    cursor_id: cursor?.id ?? null,
    page_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as AppNotification[];
}

export async function fetchUnreadCount(): Promise<number> {
  const { data, error } = await supabase.rpc('unread_notification_count');
  if (error) throw error;
  return (data ?? 0) as number;
}

// ─── Mutations ─────────────────────────────────────────────────────────────

export async function markRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId);
  if (error) throw error;
}

export async function markAllRead(): Promise<void> {
  const { error } = await supabase.rpc('mark_all_notifications_read');
  if (error) throw error;
}

