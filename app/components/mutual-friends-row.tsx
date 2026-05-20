import { Pressable, StyleSheet, View } from 'react-native';

import { FeedAvatar } from '@/components/feed-avatar';
import { ThemedText } from '@/components/themed-text';
import type { FriendProfile } from '@/lib/friends';

type Props = {
  friends: FriendProfile[];
  totalCount: number;
  onPress: () => void;
};

const MAX_SHOWN = 3;
const AVATAR_SIZE = 28;
const OVERLAP = 10;

export function MutualFriendsRow({ friends, totalCount, onPress }: Props) {
  if (totalCount === 0) return null;
  const shown = friends.slice(0, MAX_SHOWN);

  return (
    <Pressable onPress={onPress} style={styles.root}>
      <View
        style={[
          styles.avatarStack,
          { width: AVATAR_SIZE + (shown.length - 1) * (AVATAR_SIZE - OVERLAP) },
        ]}>
        {shown.map((f, i) => (
          <View
            key={f.id}
            style={[styles.avatarWrap, { left: i * (AVATAR_SIZE - OVERLAP) }]}>
            <FeedAvatar
              url={f.avatar_url}
              handle={f.handle}
              size={AVATAR_SIZE}
            />
          </View>
        ))}
      </View>
      <ThemedText style={styles.label}>
        {totalCount} mutual {totalCount === 1 ? 'friend' : 'friends'}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  avatarStack: { height: AVATAR_SIZE, position: 'relative' },
  avatarWrap: {
    position: 'absolute',
    top: 0,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 2,
    borderColor: 'rgba(127,127,127,0.15)',
    overflow: 'hidden',
  },
  label: { fontSize: 13, opacity: 0.65, fontWeight: '500' },
});
