// Avatar bubble for feed cards, comments, and likers list. Falls back to an
// initial-bubble (first letter of handle) when no avatar_url is set.

import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

type Props = {
  url: string | null;
  handle: string;
  size?: number;
  tintColor?: string;
};

export function FeedAvatar({ url, handle, size = 36, tintColor }: Props) {
  const radius = size / 2;
  const initial = (handle || '?').trim().charAt(0).toUpperCase();
  const bg = tintColor ?? 'rgba(127,127,127,0.45)';

  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={[styles.avatar, { width: size, height: size, borderRadius: radius }]}
        contentFit="cover"
        transition={150}
      />
    );
  }
  return (
    <View
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: bg,
        },
      ]}>
      <ThemedText style={[styles.initial, { fontSize: size * 0.45 }]}>
        {initial}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { backgroundColor: 'rgba(127,127,127,0.15)' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  initial: { color: '#fff', fontWeight: '700' },
});
