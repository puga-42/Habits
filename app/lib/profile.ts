import { supabase } from './supabase';

// ─── Handle validation ────────────────────────────────────────────────────

const HANDLE_RE = /^[a-zA-Z0-9_]{3,30}$/;

export type HandleValidation =
  | { ok: true }
  | { ok: false; message: string };

export function validateHandle(handle: string): HandleValidation {
  const trimmed = handle.trim();
  if (trimmed.length < 3)
    return { ok: false, message: 'Handle must be at least 3 characters.' };
  if (trimmed.length > 30)
    return { ok: false, message: 'Handle must be 30 characters or fewer.' };
  if (!HANDLE_RE.test(trimmed))
    return { ok: false, message: 'Handle may only contain letters, numbers, and underscores.' };
  return { ok: true };
}

export type Profile = {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  week_start: number;
  created_at: string;
  updated_at: string;
};

export async function fetchProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data as Profile;
}

export async function updateHandle(
  userId: string,
  handle: string,
): Promise<void> {
  const validation = validateHandle(handle);
  if (!validation.ok) throw new Error(validation.message);
  const { error } = await supabase
    .from('profiles')
    .update({ handle: handle.trim() })
    .eq('id', userId);
  if (error) {
    if (error.code === '23505') throw new Error('Handle already taken.');
    throw error;
  }
}

export async function updateWeekStart(
  userId: string,
  weekStart: number,
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ week_start: weekStart })
    .eq('id', userId);
  if (error) throw error;
}

export const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export function weekdayName(n: number): string {
  return WEEKDAY_NAMES[n] ?? 'Sunday';
}
