// Horizontal pager for multi-attachment completions. Single attachment
// renders without dots; >1 renders the pager with dot indicators below.

import { useEffect, useState } from 'react';
import {
  Dimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { FeedAttachment } from '@/components/feed-attachment';
import type { Attachment } from '@/lib/feed';
import { signedUrlsForPaths } from '@/lib/feed';
import { useTokens } from '@/hooks/use-tokens';

type Props = {
  attachments: Attachment[];
  cardWidth?: number;
};

export function FeedAttachmentCarousel({ attachments, cardWidth }: Props) {
  const t = useTokens();
  const width = cardWidth ?? Dimensions.get('window').width;
  const [page, setPage] = useState(0);
  const [urls, setUrls] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const paths = attachments.map((a) => a.storage_path);
    signedUrlsForPaths(paths).then((map) => {
      if (!cancelled) setUrls(map);
    });
    return () => {
      cancelled = true;
    };
  }, [attachments]);

  if (attachments.length === 0) return null;

  if (attachments.length === 1) {
    return (
      <FeedAttachment
        attachment={attachments[0]}
        signedUrl={urls.get(attachments[0].storage_path)}
        width={width}
      />
    );
  }

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const p = Math.round(x / width);
    if (p !== page) setPage(p);
  };

  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        scrollEventThrottle={16}>
        {attachments.map((a) => (
          <FeedAttachment
            key={a.id}
            attachment={a}
            signedUrl={urls.get(a.storage_path)}
            width={width}
          />
        ))}
      </ScrollView>
      <View style={styles.dots}>
        {attachments.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              { backgroundColor: t.ink45 },
              i === page && { backgroundColor: t.ink },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
