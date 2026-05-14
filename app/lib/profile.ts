import { supabase } from './supabase';

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
