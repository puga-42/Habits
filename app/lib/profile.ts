import * as Crypto from 'expo-crypto';
import { File as ExpoFile } from 'expo-file-system';

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

export type CropParams = {
  scale: number;
  translateX: number;
  translateY: number;
};

export type Profile = {
  id: string;
  handle: string;
  avatar_url: string | null;
  avatar_original_url: string | null;
  avatar_crop_params: CropParams | null;
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

// ─── Avatar upload ─────────────────────────────────────────────────────────

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

async function uploadToStorage(
  userId: string,
  file: { uri: string; mimeType: string },
): Promise<string> {
  const ext = MIME_EXT[file.mimeType] ?? 'jpg';
  const storagePath = `${userId}/${Crypto.randomUUID()}.${ext}`;

  const expoFile = new ExpoFile(file.uri);
  if (!expoFile.exists) throw new Error('File not found');
  const bytes = await expoFile.bytes();

  const { error: uploadErr } = await supabase.storage
    .from('avatars')
    .upload(storagePath, bytes, { contentType: file.mimeType });
  if (uploadErr) throw uploadErr;

  const { data: urlData } = supabase.storage
    .from('avatars')
    .getPublicUrl(storagePath);

  return urlData.publicUrl;
}

export async function uploadAvatar(
  userId: string,
  file: { uri: string; mimeType: string },
): Promise<string> {
  const publicUrl = await uploadToStorage(userId, file);

  const { error: updateErr } = await supabase
    .from('profiles')
    .update({
      avatar_url: publicUrl,
      avatar_original_url: publicUrl,
      avatar_crop_params: null,
    })
    .eq('id', userId);
  if (updateErr) throw updateErr;

  return publicUrl;
}

export async function uploadCroppedAvatar(
  userId: string,
  croppedFile: { uri: string; mimeType: string },
  cropParams: CropParams,
): Promise<string> {
  const publicUrl = await uploadToStorage(userId, croppedFile);

  const { error: updateErr } = await supabase
    .from('profiles')
    .update({
      avatar_url: publicUrl,
      avatar_crop_params: cropParams,
    })
    .eq('id', userId);
  if (updateErr) throw updateErr;

  return publicUrl;
}

export async function fetchAvatarOriginal(
  userId: string,
): Promise<{ originalUrl: string | null; cropParams: CropParams | null }> {
  const { data, error } = await supabase
    .from('profiles')
    .select('avatar_original_url, avatar_crop_params')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return {
    originalUrl: data.avatar_original_url as string | null,
    cropParams: data.avatar_crop_params as CropParams | null,
  };
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
