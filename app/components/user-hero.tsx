import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { FeedAvatar } from '@/components/feed-avatar';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { blockUser, reportContent } from '@/lib/feed';
import {
  acceptFriendRequest,
  cancelFriendRequest,
  removeFriend,
  sendFriendRequest,
} from '@/lib/friends';
import type { FriendshipStatus, UserProfileData } from '@/lib/user-profile';
import { friendshipActionLabel } from '@/lib/user-profile';

type Props = {
  profile: UserProfileData;
  viewerId: string;
  targetId: string;
  onReload: () => void;
  onBack: () => void;
};

export function UserHero({ profile, viewerId, targetId, onReload, onBack }: Props) {
  const isSelf = profile.friendship_status === 'self';
  const label = friendshipActionLabel(profile.friendship_status);

  const handleFriendAction = async () => {
    const st = profile.friendship_status;
    if (st === 'none') {
      await sendFriendRequest(viewerId, targetId);
      onReload();
    } else if (st === 'pending_outgoing') {
      Alert.alert('Cancel request?', undefined, [
        { text: 'Keep', style: 'cancel' },
        { text: 'Cancel request', style: 'destructive', onPress: () => cancelFriendRequest(targetId).then(onReload) },
      ]);
    } else if (st === 'pending_incoming') {
      await acceptFriendRequest(targetId);
      onReload();
    } else if (st === 'friend') {
      Alert.alert(`Remove @${profile.handle}?`, 'You can send a new request later.', [
        { text: 'Keep', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removeFriend(viewerId, targetId).then(onReload) },
      ]);
    }
  };

  const openOverflow = () => {
    Alert.alert('Options', undefined, [
      { text: 'Report user', onPress: () => reportContent(viewerId, { kind: 'completion', id: targetId }) },
      { text: 'Block user', onPress: () => blockUser(viewerId, targetId).then(onBack), style: 'destructive' },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View style={styles.root}>
      <FeedAvatar url={profile.avatar_url} handle={profile.handle} size={96} />
      <ThemedText type="title" style={styles.handle}>@{profile.handle}</ThemedText>

      {!isSelf && label && (
        <View style={styles.actions}>
          <Pressable onPress={handleFriendAction} style={[styles.btn, btnBg(profile.friendship_status)]}>
            <ThemedText style={[styles.btnText, btnFg(profile.friendship_status)]}>{label}</ThemedText>
          </Pressable>
          <Pressable onPress={openOverflow} hitSlop={10} style={styles.overflow}>
            <IconSymbol name="ellipsis" color="rgba(127,127,127,0.9)" size={22} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

function btnBg(st: FriendshipStatus) {
  return st === 'none' || st === 'pending_incoming' ? styles.btnAccent : styles.btnGhost;
}
function btnFg(st: FriendshipStatus) {
  return st === 'none' || st === 'pending_incoming' ? styles.btnTextAccent : styles.btnTextGhost;
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', paddingTop: 24, paddingBottom: 16, gap: 8 },
  handle: { marginTop: 4 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  btn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, minWidth: 110, alignItems: 'center' },
  btnAccent: { backgroundColor: '#0a7ea4' },
  btnGhost: { backgroundColor: 'rgba(127,127,127,0.12)' },
  btnText: { fontSize: 14, fontWeight: '600' },
  btnTextAccent: { color: '#fff' },
  btnTextGhost: { opacity: 0.7 },
  overflow: { padding: 4 },
});
