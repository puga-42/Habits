import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

type Props = {
  title: string;
  onMenuPress: () => void;
  rightSlot?: ReactNode;
};

export function TabTopBar({ title, onMenuPress, rightSlot }: Props) {
  return (
    <View style={styles.bar}>
      <Pressable onPress={onMenuPress} hitSlop={12} style={styles.side}>
        <ThemedText style={styles.menuIcon}>☰</ThemedText>
      </Pressable>
      <View style={styles.titleWrap}>
        <ThemedText type="defaultSemiBold" style={styles.title} numberOfLines={1}>
          {title}
        </ThemedText>
      </View>
      <View style={styles.sideRight}>{rightSlot}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  side: { width: 80, alignItems: 'flex-start' },
  sideRight: { width: 80, alignItems: 'flex-end' },
  menuIcon: { fontSize: 24, paddingHorizontal: 6, paddingVertical: 4 },
  titleWrap: { flex: 1, alignItems: 'center' },
  title: { fontSize: 18 },
});
