import { supabase } from './supabase';
import type { Visibility } from './habits';

export type Profile = {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  week_start: number;
  default_visibility: Visibility;
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

export async function updateDefaultVisibility(
  userId: string,
  visibility: Visibility,
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ default_visibility: visibility })
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
