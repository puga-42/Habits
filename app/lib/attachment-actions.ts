import { Alert } from 'react-native';

import {
  deleteAttachment,
  reorderAttachments,
  uploadAttachment,
  validateAttachment,
} from '@/lib/completions';
import { signedUrlsForPaths } from '@/lib/feed';
import { pickMediaAsset } from '@/lib/media-picker';
import { validationMessage, type OverviewCompletion } from '@/lib/habit-overview';

export type CompletionsSetter = React.Dispatch<
  React.SetStateAction<OverviewCompletion[]>
>;
export type UrlsSetter = React.Dispatch<
  React.SetStateAction<Map<string, string>>
>;

export async function pickAndUpload(
  completionId: string,
  userId: string,
  completions: OverviewCompletion[],
  setCompletions: CompletionsSetter,
  setSignedUrls: UrlsSetter,
): Promise<void> {
  const comp = completions.find((c) => c.id === completionId);
  if (!comp) return;

  const picked = await pickMediaAsset();
  if (!picked) return;

  const error = validateAttachment(picked, comp.attachments.length);
  if (error) {
    Alert.alert('Cannot add attachment', validationMessage(error));
    return;
  }

  const attachment = await uploadAttachment(completionId, userId, {
    uri: picked.uri,
    mimeType: picked.mimeType,
    width: picked.width,
    height: picked.height,
    duration: picked.durationSeconds,
  });

  setCompletions((prev) =>
    prev.map((c) =>
      c.id === completionId
        ? { ...c, attachments: [...c.attachments, attachment] }
        : c,
    ),
  );

  const urls = await signedUrlsForPaths([attachment.storage_path]);
  setSignedUrls((prev) => {
    const next = new Map(prev);
    for (const [k, v] of urls) next.set(k, v);
    return next;
  });
}

export function removeAttachment(
  completionId: string,
  attachmentId: string,
  setCompletions: CompletionsSetter,
): void {
  setCompletions((prev) =>
    prev.map((c) =>
      c.id === completionId
        ? { ...c, attachments: c.attachments.filter((a) => a.id !== attachmentId) }
        : c,
    ),
  );
  deleteAttachment(attachmentId);
}

export function reorderCompletionAttachments(
  completionId: string,
  orderedIds: string[],
  setCompletions: CompletionsSetter,
): void {
  setCompletions((prev) =>
    prev.map((c) =>
      c.id === completionId
        ? {
            ...c,
            attachments: orderedIds
              .map((oid) => c.attachments.find((a) => a.id === oid))
              .filter(Boolean) as OverviewCompletion['attachments'],
          }
        : c,
    ),
  );
  reorderAttachments(orderedIds);
}
