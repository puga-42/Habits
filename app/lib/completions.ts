import * as Crypto from 'expo-crypto';
import { File as ExpoFile } from 'expo-file-system';

import { supabase } from './supabase';
import type { Visibility } from './habits';
import { attachmentKindForMime, storagePathFor } from './attachments';
import type { AttachmentDetail } from './attachments';

// The attachment validation, limits, mime, and path helpers now live in the
// shared `attachments` module (reused by rest attachments). Re-exported here so
// existing importers of '@/lib/completions' keep working unchanged.
export {
  ALLOWED_PHOTO_MIMES,
  ALLOWED_VIDEO_MIMES,
  MAX_PHOTO_BYTES,
  MAX_VIDEO_BYTES,
  MAX_VIDEO_SECONDS,
  MAX_ATTACHMENTS,
  validateAttachment,
  computeSortOrders,
} from './attachments';
export type { AttachmentDetail, ValidationError } from './attachments';

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
  const uuid = Crypto.randomUUID();
  const storagePath = storagePathFor(ownerId, completionId, uuid, file.mimeType);

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

  const { data, error: insertErr } = await supabase
    .from('completion_attachments')
    .insert({
      completion_id: completionId,
      owner_id: ownerId,
      kind: attachmentKindForMime(file.mimeType),
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
