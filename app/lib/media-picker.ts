// The ONE media picker for attachment flows (completions, rests). Three
// screens previously each configured their own picker and drifted; two bugs
// came from that drift:
//   - videoMaxDuration forces the legacy UIImagePickerController → Photos
//     permission prompt AFTER picking + PHAsset export that fails under
//     denied/limited access (PHPhotosErrorDomain 3164). The 30s cap is
//     enforced post-pick by validateAttachment instead.
//   - transcoding on export fails for iCloud-stored / HDR videos
//     (PHPhotosErrorDomain 3154). preferredAssetRepresentationMode 'current'
//     passes the existing representation through without re-encoding.
//   - expo-image-picker's PASSTHROUGH fast path (MediaHandler.handleVideo)
//     fetches videos via PHAsset/PHAssetResourceManager — photo-library APIs
//     that need authorization. Under LIMITED Photos access this throws
//     PHPhotosErrorDomain for any video outside the limited selection (their
//     "graceful fallback" comment lies — the throw propagates). Setting a
//     non-passthrough videoExportPreset makes that path unreachable: videos
//     come through the out-of-process item provider (no permission) and are
//     transcoded locally to 720p H.264 — fine, since the server re-transcodes
//     uploads to 480p anyway (CONTEXT.md § Attachments), and it shrinks
//     uploads against the 50 MB cap.
// Callers MUST wrap in try/catch (picker + iCloud fetch can still reject)
// and feed the result through validateAttachment.

import * as ImagePicker from 'expo-image-picker';

export type PickedMedia = {
  uri: string;
  mimeType: string;
  byteSize: number;
  durationSeconds: number | undefined;
  width: number | undefined;
  height: number | undefined;
};

// Pure: normalize an ImagePicker asset (exported for tests).
export function normalizePickedAsset(asset: {
  uri: string;
  mimeType?: string | null;
  type?: string | null;
  fileSize?: number | null;
  duration?: number | null;
  width?: number | null;
  height?: number | null;
}): PickedMedia {
  return {
    uri: asset.uri,
    mimeType:
      asset.mimeType ?? (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'),
    byteSize: asset.fileSize ?? 0,
    // Whole seconds: the duration_seconds column is an INTEGER — Postgres
    // rejects fractional values ('invalid input syntax for type integer').
    durationSeconds: asset.duration ? Math.round(asset.duration / 1000) : undefined,
    width: asset.width ?? undefined,
    height: asset.height ?? undefined,
  };
}

// null = user canceled. Throws on real picker/export failures.
export async function pickMediaAsset(): Promise<PickedMedia | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'],
    quality: 0.8,
    videoExportPreset: ImagePicker.VideoExportPreset.H264_1280x720,
    preferredAssetRepresentationMode:
      ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
  });
  if (result.canceled || result.assets.length === 0) return null;
  return normalizePickedAsset(result.assets[0]);
}
