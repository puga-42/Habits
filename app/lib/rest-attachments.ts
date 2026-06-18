import * as Crypto from 'expo-crypto';
import { File as ExpoFile } from 'expo-file-system';

import { supabase } from './supabase';
import {
  attachmentKindForMime,
  storagePathFor,
  type AttachmentDetail,
} from './attachments';

// Rest media reuses the same `completion-media` bucket and attachment limits as
// completions; only the owning table differs. Path is `{owner}/{rest_id}/{uuid}`.
const BUCKET = 'completion-media';

export async function listRestAttachments(
  restId: string,
): Promise<AttachmentDetail[]> {
  const { data, error } = await supabase
    .from('rest_attachments')
    .select('*')
    .eq('rest_id', restId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as AttachmentDetail[];
}

export async function uploadRestAttachment(
  restId: string,
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
  const storagePath = storagePathFor(ownerId, restId, uuid, file.mimeType);

  const expoFile = new ExpoFile(file.uri);
  if (!expoFile.exists) throw new Error('File not found');
  const byteSize = expoFile.size ?? 0;

  const bytes = await expoFile.bytes();
  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType: file.mimeType });
  if (uploadErr) throw uploadErr;

  const { data: maxRow } = await supabase
    .from('rest_attachments')
    .select('sort_order')
    .eq('rest_id', restId)
    .order('sort_order', { ascending: false })
    .limit(1);
  const nextOrder = (maxRow?.[0]?.sort_order ?? -1) + 1;

  const { data, error: insertErr } = await supabase
    .from('rest_attachments')
    .insert({
      rest_id: restId,
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

export async function deleteRestAttachment(attachmentId: string): Promise<void> {
  const { data, error: fetchErr } = await supabase
    .from('rest_attachments')
    .select('storage_path')
    .eq('id', attachmentId)
    .single();
  if (fetchErr) throw fetchErr;

  const { error: deleteErr } = await supabase
    .from('rest_attachments')
    .delete()
    .eq('id', attachmentId);
  if (deleteErr) throw deleteErr;

  await supabase.storage.from(BUCKET).remove([data.storage_path]);
}

export async function reorderRestAttachments(orderedIds: string[]): Promise<void> {
  const updates = orderedIds.map((id, idx) =>
    supabase.from('rest_attachments').update({ sort_order: idx }).eq('id', id),
  );
  const results = await Promise.all(updates);
  for (const r of results) {
    if (r.error) throw r.error;
  }
}
