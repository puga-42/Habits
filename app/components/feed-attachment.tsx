// Single attachment renderer. Resolves a signed URL on mount (or accepts a
// pre-resolved one) and displays the media inline.
//
// Photos use expo-image, which handles HEIC + caching out of the box. Videos
// don't render inline in v1 — they show a poster-like thumbnail with a play
// icon overlay; tapping opens a fullscreen viewer (placeholder for now). When
// expo-video lands in deps, swap the video branch.

import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import type { Attachment } from '@/lib/feed';
import { signedUrlsForPaths } from '@/lib/feed';

type Props = {
  attachment: Attachment;
  signedUrl?: string;
  width: number;
  aspectRatio?: number;
  onPress?: () => void;
};

export function FeedAttachment({
  attachment,
  signedUrl,
  width,
  aspectRatio,
  onPress,
}: Props) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(
    signedUrl ?? null,
  );

  useEffect(() => {
    if (signedUrl) {
      setResolvedUrl(signedUrl);
      return;
    }
    let cancelled = false;
    signedUrlsForPaths([attachment.storage_path]).then((map) => {
      if (cancelled) return;
      const url = map.get(attachment.storage_path);
      if (url) setResolvedUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [attachment.storage_path, signedUrl]);

  const ratio =
    aspectRatio ??
    (attachment.kind === 'video'
      ? 16 / 9
      : attachment.width && attachment.height
        ? attachment.width / attachment.height
        : 4 / 5);
  const height = width / ratio;

  return (
    <Pressable onPress={onPress} style={{ width, height }}>
      {resolvedUrl ? (
        <Image
          source={{ uri: resolvedUrl }}
          style={styles.media}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <View style={[styles.media, styles.placeholder]} />
      )}
      {attachment.kind === 'video' ? (
        <View style={styles.playOverlay} pointerEvents="none">
          <View style={styles.playBubble}>
            <IconSymbol name="play.fill" color="#fff" size={28} />
          </View>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  media: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(127,127,127,0.15)',
  },
  placeholder: { backgroundColor: 'rgba(127,127,127,0.1)' },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBubble: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
