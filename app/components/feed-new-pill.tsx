// Floating pill that appears at the top of the feed when Realtime delivers
// new items while the user has scrolled away from the top.

import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Palette } from '@/constants/colors';
import { IconSymbol } from '@/components/ui/icon-symbol';

type Props = {
  count: number;
  onPress: () => void;
};

export function FeedNewPill({ count, onPress }: Props) {
  if (count <= 0) return null;
  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}>
        <IconSymbol name="arrow.up" color="#fff" size={16} />
        <ThemedText style={styles.text}>
          {count === 1 ? '1 new post' : `${count} new posts`}
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: Palette.primary,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  pillPressed: { opacity: 0.8 },
  text: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
