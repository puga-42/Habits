import * as Crypto from 'expo-crypto';
import { File as ExpoFile } from 'expo-file-system';

import { supabase } from './supabase';
import type { Visibility } from './habits';

// ─── Types ──────────────────────────────────────────────────────────────────

export type CompletionDetail = {
  id: string;
  habit_id: string;
  owner_id: string;
  completed_at: string;
  occurrence_date: string | null;
  period_start: string | null;
  note: string | null;
  visibility_override: Visibility | null;
  habit: {
    title: string;
    icon: string | null;
    color: string | null;
    visibility: Visibility;
  };
  attachments: AttachmentDetail[];
};

export type AttachmentDetail = {
  id: string;
  kind: 'photo' | 'video';
  storage_path: string;
  mime_type: string;
  byte_size: number;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  sort_order: number;
  signed_url?: string;
};

// ─── Constants ──────────────────────────────────────────────────────────────

export const ALLOWED_PHOTO_MIMES = [
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
];

export const ALLOWED_VIDEO_MIMES = ['video/mp4', 'video/quicktime'];

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB
export const MAX_VIDEO_SECONDS = 30;
export const MAX_ATTACHMENTS = 10;

// ─── Validation (pure) ──────────────────────────────────────────────────────

export type ValidationError =
  | { kind: 'too_large'; maxMb: number; actualMb: number }
  | { kind: 'too_long'; maxSeconds: number; actualSeconds: number }
  | { kind: 'cap_reached'; max: number }
  | { kind: 'unsupported_type'; mime: string };

export function validateAttachment(
  file: { mimeType: string; byteSize: number; durationSeconds?: number },
  existingCount: number,
): ValidationError | null {
  if (existingCount >= MAX_ATTACHMENTS) {
    return { kind: 'cap_reached', max: MAX_ATTACHMENTS };
  }

  const isPhoto = ALLOWED_PHOTO_MIMES.includes(file.mimeType);
  const isVideo = ALLOWED_VIDEO_MIMES.includes(file.mimeType);

  if (!isPhoto && !isVideo) {
    return { kind: 'unsupported_type', mime: file.mimeType };
  }

  if (isPhoto && file.byteSize > MAX_PHOTO_BYTES) {
    return {
      kind: 'too_large',
      maxMb: MAX_PHOTO_BYTES / (1024 * 1024),
      actualMb: file.byteSize / (1024 * 1024),
    };
  }

  if (isVideo) {
    if (file.byteSize > MAX_VIDEO_BYTES) {
      return {
        kind: 'too_large',
        maxMb: MAX_VIDEO_BYTES / (1024 * 1024),
        actualMb: file.byteSize / (1024 * 1024),
      };
    }
    if (
      file.durationSeconds != null &&
      file.durationSeconds > MAX_VIDEO_SECONDS
    ) {
      return {
        kind: 'too_long',
        maxSeconds: MAX_VIDEO_SECONDS,
        actualSeconds: file.durationSeconds,
      };
    }
  }

  return null;
}

// ─── Reorder (pure) ─────────────────────────────────────────────────────────

export function computeSortOrders(orderedIds: string[]): { id: string; sort_order: number }[] {
  return orderedIds.map((id, i) => ({ id, sort_order: i }));
}

// ─── Queries ────────────────────────────────────────────────────────────────

export async function fetchCompletionDetail(
  completionId: string,
): Promise<CompletionDetail> {
  const { data, error } = await supabase
    .from('habit_completions')
    .select(
      '*, habits!inner(title, icon, color, visibility)',
    )
    .eq('id', completionId)
    .single();
  if (error) throw error;

  const { data: attachments, error: aErr } = await supabase
    .from('completion_attachments')
    .select('*')
    .eq('completion_id', completionId)
    .order('sort_order', { ascending: true });
  if (aErr) throw aErr;

  const habit = data.habits as {
    title: string;
    icon: string | null;
    color: string | null;
    visibility: Visibility;
  };

  return {
    id: data.id,
    habit_id: data.habit_id,
    owner_id: data.owner_id,
    completed_at: data.completed_at,
    occurrence_date: data.occurrence_date,
    period_start: data.period_start,
    note: data.note,
    visibility_override: data.visibility_override,
    habit,
    attachments: (attachments ?? []) as AttachmentDetail[],
  };
}

// ─── Note ───────────────────────────────────────────────────────────────────

export async function updateNote(
  completionId: string,
  note: string | null,
): Promise<void> {
  const trimmed = note?.trim() || null;
  const { error } = await supabase
    .from('habit_completions')
    .update({ note: trimmed })
    .eq('id', completionId);
  if (error) throw error;
}

// ─── Visibility ─────────────────────────────────────────────────────────────

export async function updateVisibilityOverride(
  completionId: string,
  override: Visibility | null,
): Promise<void> {
  const { error } = await supabase
    .from('habit_completions')
    .update({ visibility_override: override })
    .eq('id', completionId);
  if (error) throw error;
}

// ─── Attachments ────────────────────────────────────────────────────────────

export async function uploadAttachment(
  completionId: string,
  ownerId: string,
  file: {
    uri: string;
    mimeType: string;
    width?: number;
    height?: number;
    duration?: number;
  },
): Promise<AttachmentDetail> {
  const ext = extensionForMime(file.mimeType);
  const uuid = Crypto.randomUUID();
  const storagePath = `${ownerId}/${completionId}/${uuid}.${ext}`;

  const expoFile = new ExpoFile(file.uri);
  if (!expoFile.exists) throw new Error('File not found');
  const byteSize = expoFile.size ?? 0;

  const bytes = await expoFile.bytes();
  const { error: uploadErr } = await supabase.storage
    .from('completion-media')
    .upload(storagePath, bytes, { contentType: file.mimeType });
  if (uploadErr) throw uploadErr;

  const { data: maxRow } = await supabase
    .from('completion_attachments')
    .select('sort_order')
    .eq('completion_id', completionId)
    .order('sort_order', { ascending: false })
    .limit(1);
  const nextOrder = (maxRow?.[0]?.sort_order ?? -1) + 1;

  const kind: 'photo' | 'video' = ALLOWED_VIDEO_MIMES.includes(file.mimeType)
    ? 'video'
    : 'photo';

  const { data, error: insertErr } = await supabase
    .from('completion_attachments')
    .insert({
      completion_id: completionId,
      owner_id: ownerId,
      kind,
      storage_path: storagePath,
      mime_type: file.mimeType,
      byte_size: byteSize,
      width: file.width ?? null,
      height: file.height ?? null,
      duration_seconds: file.duration ?? null,
      sort_order: nextOrder,
    })
    .select('*')
    .single();
  if (insertErr) throw insertErr;

  return data as AttachmentDetail;
}

export async function deleteAttachment(attachmentId: string): Promise<void> {
  const { data, error: fetchErr } = await supabase
    .from('completion_attachments')
    .select('storage_path')
    .eq('id', attachmentId)
    .single();
  if (fetchErr) throw fetchErr;

  const { error: deleteErr } = await supabase
    .from('completion_attachments')
    .delete()
    .eq('id', attachmentId);
  if (deleteErr) throw deleteErr;

  await supabase.storage.from('completion-media').remove([data.storage_path]);
}

export async function reorderAttachments(orderedIds: string[]): Promise<void> {
  const updates = orderedIds.map((id, idx) =>
    supabase
      .from('completion_attachments')
      .update({ sort_order: idx })
      .eq('id', id),
  );
  const results = await Promise.all(updates);
  for (const r of results) {
    if (r.error) throw r.error;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function extensionForMime(mime: string): string {
  switch (mime) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/heic':
      return 'heic';
    case 'image/heif':
      return 'heif';
    case 'video/mp4':
      return 'mp4';
    case 'video/quicktime':
      return 'mov';
    default:
      return 'bin';
  }
}
