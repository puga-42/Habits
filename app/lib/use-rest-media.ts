import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { validateAttachment, type AttachmentDetail } from '@/lib/attachments';
import { signedUrlsForPaths } from '@/lib/feed';
import { errorMessage } from '@/lib/error-message';
import { pickMediaAsset } from '@/lib/media-picker';
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
    try {
      const picked = await pickMediaAsset();
      if (!picked) return;
      const err = validateAttachment(picked, attachments.length);
      if (err) {
        Alert.alert('Cannot add attachment', validationMessage(err));
        return;
      }
      const attachment = await uploadRestAttachment(restId, userId, {
        uri: picked.uri,
        mimeType: picked.mimeType,
        width: picked.width,
        height: picked.height,
        duration: picked.durationSeconds,
      });
      setAttachments((prev) => [...prev, attachment]);
      const urls = await signedUrlsForPaths([attachment.storage_path]);
      setSignedUrls((prev) => {
        const next = new Map(prev);
        for (const [k, v] of urls) next.set(k, v);
        return next;
      });
    } catch (err) {
      Alert.alert('Upload failed', errorMessage(err));
    }
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
