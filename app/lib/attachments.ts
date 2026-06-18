// Shared, side-effect-free helpers for photo/video attachments. Both completion
// attachments and rest attachments live in the same `completion-media` bucket
// and obey the same limits, so the validation, mime, and path logic is defined
// once here and reused by `completions.ts` and `rests.ts`.

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

export function computeSortOrders(
  orderedIds: string[],
): { id: string; sort_order: number }[] {
  return orderedIds.map((id, i) => ({ id, sort_order: i }));
}

export function attachmentKindForMime(mime: string): 'photo' | 'video' {
  return ALLOWED_VIDEO_MIMES.includes(mime) ? 'video' : 'photo';
}

export function extensionForMime(mime: string): string {
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

// Storage object path: `{owner_id}/{parent_id}/{uuid}.{ext}`. `parent_id` is the
// owning completion or rest. The first segment must be the owner uid — the
// bucket's RLS keys upload/delete on it.
export function storagePathFor(
  ownerId: string,
  parentId: string,
  uuid: string,
  mime: string,
): string {
  return `${ownerId}/${parentId}/${uuid}.${extensionForMime(mime)}`;
}
