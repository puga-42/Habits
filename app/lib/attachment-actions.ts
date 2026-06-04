import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

import {
  deleteAttachment,
  reorderAttachments,
  uploadAttachment,
  validateAttachment,
} from '@/lib/completions';
import { signedUrlsForPaths } from '@/lib/feed';
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

  const error = validateAttachment(
    { mimeType, byteSize, durationSeconds },
    comp.attachments.length,
  );
  if (error) {
    Alert.alert('Cannot add attachment', validationMessage(error));
    return;
  }

  const attachment = await uploadAttachment(completionId, userId, {
    uri: asset.uri,
    mimeType,
    width: asset.width,
    height: asset.height,
    duration: durationSeconds,
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
