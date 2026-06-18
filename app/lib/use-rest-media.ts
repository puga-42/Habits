import { useCallback, useEffect, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

import { validateAttachment, type AttachmentDetail } from '@/lib/attachments';
import { signedUrlsForPaths } from '@/lib/feed';
import { validationMessage } from '@/lib/habit-overview';
import {
  deleteRestAttachment,
  listRestAttachments,
  reorderRestAttachments,
  uploadRestAttachment,
} from '@/lib/rest-attachments';

// Loads + mutates one rest's media for the editor sheet. Mirrors the completion
// attachment flow (attachment-actions.ts) but scoped to a single rest and its
// own attachment list, so the sheet stays presentational.
export function useRestMedia(restId: string | null, userId: string) {
  const [attachments, setAttachments] = useState<AttachmentDetail[]>([]);
  const [signedUrls, setSignedUrls] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!restId) {
      setAttachments([]);
      setSignedUrls(new Map());
      return;
    }
    let cancelled = false;
    setLoading(true);
    listRestAttachments(restId)
      .then(async (rows) => {
        if (cancelled) return;
        setAttachments(rows);
        const urls = await signedUrlsForPaths(rows.map((a) => a.storage_path));
        if (!cancelled) setSignedUrls(urls);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [restId]);

  const add = useCallback(async () => {
    if (!restId) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.8,
      videoMaxDuration: 30,
    });
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0];
    const mimeType =
      asset.mimeType ?? (asset.type === 'video' ? 'video/mp4' : 'image/jpeg');
    const byteSize = asset.fileSize ?? 0;
    const durationSeconds = asset.duration ? asset.duration / 1000 : undefined;
    const err = validateAttachment(
      { mimeType, byteSize, durationSeconds },
      attachments.length,
    );
    if (err) {
      Alert.alert('Cannot add attachment', validationMessage(err));
      return;
    }
    const attachment = await uploadRestAttachment(restId, userId, {
      uri: asset.uri,
      mimeType,
      width: asset.width,
      height: asset.height,
      duration: durationSeconds,
    });
    setAttachments((prev) => [...prev, attachment]);
    const urls = await signedUrlsForPaths([attachment.storage_path]);
    setSignedUrls((prev) => {
      const next = new Map(prev);
      for (const [k, v] of urls) next.set(k, v);
      return next;
    });
  }, [restId, userId, attachments.length]);

  const remove = useCallback((attachmentId: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    deleteRestAttachment(attachmentId);
  }, []);

  const reorder = useCallback((orderedIds: string[]) => {
    setAttachments(
      (prev) =>
        orderedIds
          .map((id) => prev.find((a) => a.id === id))
          .filter(Boolean) as AttachmentDetail[],
    );
    reorderRestAttachments(orderedIds);
  }, []);

  return { attachments, signedUrls, loading, add, remove, reorder };
}
