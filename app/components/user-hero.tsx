import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActionSheetIOS, ActivityIndicator, Alert, Platform, Pressable, StyleSheet, View } from 'react-native';

import { AvatarCropModal } from '@/components/avatar-crop-modal';
import { AvatarViewerModal } from '@/components/avatar-viewer-modal';
import { FeedAvatar } from '@/components/feed-avatar';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useTokens } from '@/hooks/use-tokens';
import { blockUser, reportContent } from '@/lib/feed';
import {
  acceptFriendRequest,
  cancelFriendRequest,
  removeFriend,
  sendFriendRequest,
} from '@/lib/friends';
import type { CropParams } from '@/lib/profile';
import { fetchAvatarOriginal, uploadAvatar, uploadCroppedAvatar } from '@/lib/profile';
import type { FriendshipStatus, UserProfileData } from '@/lib/user-profile';
import { friendshipActionLabel } from '@/lib/user-profile';

type Props = {
  profile: UserProfileData;
  viewerId: string;
  targetId: string;
  onReload: () => void;
  onBack: () => void;
};

async function pickImage(source: 'library' | 'camera'): Promise<ImagePicker.ImagePickerResult> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('Camera permission denied');
    return ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
  }
  return ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
}

export function UserHero({ profile, viewerId, targetId, onReload, onBack }: Props) {
  const t = useTokens();
  const isSelf = profile.friendship_status === 'self';
  const label = friendshipActionLabel(profile.friendship_status);
  const [uploading, setUploading] = useState(false);
  const [cropUri, setCropUri] = useState<string | null>(null);
  const [cropParams, setCropParams] = useState<CropParams | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  const handleAvatarEdit = () => {
    const hasAvatar = !!profile.avatar_url;
    const options = hasAvatar
      ? ['Choose from Library', 'Take Photo', 'View Profile Photo', 'Cancel']
      : ['Choose from Library', 'Take Photo', 'Cancel'];
    const cancelIdx = options.length - 1;
    const openCropModal = async () => {
      try {
        const original = await fetchAvatarOriginal(viewerId);
        setCropParams(original.cropParams);
        setCropUri(original.originalUrl ?? profile.avatar_url);
      } catch {
        setCropParams(null);
        setCropUri(profile.avatar_url);
      }
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: cancelIdx },
        (idx) => {
          if (idx === 0) doAvatarUpload('library');
          else if (idx === 1) doAvatarUpload('camera');
          else if (hasAvatar && idx === 2) openCropModal();
        },
      );
    } else {
      const items: { text: string; onPress?: () => void; style?: 'cancel' }[] = [
        { text: 'Choose from Library', onPress: () => doAvatarUpload('library') },
        { text: 'Take Photo', onPress: () => doAvatarUpload('camera') },
      ];
      if (hasAvatar) items.push({ text: 'View Profile Photo', onPress: openCropModal });
      items.push({ text: 'Cancel', style: 'cancel' });
      Alert.alert('Change Photo', undefined, items);
    }
  };

  const doAvatarUpload = async (source: 'library' | 'camera') => {
    try {
      const result = await pickImage(source);
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      setUploading(true);
      await uploadAvatar(viewerId, {
        uri: asset.uri,
        mimeType: asset.mimeType ?? 'image/jpeg',
      });
      onReload();
    } catch (err) {
      Alert.alert('Upload failed', err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  };

  const handleCropSave = async (croppedUri: string, params: CropParams) => {
    setCropUri(null);
    setUploading(true);
    try {
      await uploadCroppedAvatar(viewerId, { uri: croppedUri, mimeType: 'image/jpeg' }, params);
      onReload();
    } catch (err) {
      Alert.alert('Upload failed', err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  };

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
      {isSelf ? (
        <Pressable onPress={handleAvatarEdit} disabled={uploading}>
          <FeedAvatar url={profile.avatar_url} handle={profile.handle} size={96} />
          <View style={styles.cameraBadge}>
            {uploading
              ? <ActivityIndicator size={14} color="#fff" />
              : <IconSymbol name="camera.fill" color="#fff" size={14} />}
          </View>
        </Pressable>
      ) : (
        <Pressable onPress={() => setViewerOpen(true)}>
          <FeedAvatar url={profile.avatar_url} handle={profile.handle} size={96} />
        </Pressable>
      )}
      <ThemedText type="title" style={styles.handle}>@{profile.handle}</ThemedText>

      {!isSelf && label && (
        <View style={styles.actions}>
          <Pressable onPress={handleFriendAction} style={[styles.btn, btnBg(profile.friendship_status, t.accent, t.surfaceRaised)]}>
            <ThemedText style={[styles.btnText, btnFg(profile.friendship_status)]}>{label}</ThemedText>
          </Pressable>
          <Pressable onPress={openOverflow} hitSlop={10} style={styles.overflow}>
            <IconSymbol name="ellipsis" color={t.ink70} size={22} />
          </Pressable>
        </View>
      )}
      <AvatarCropModal
        visible={cropUri !== null}
        imageUri={cropUri}
        initialCropParams={cropParams}
        onSave={handleCropSave}
        onCancel={() => setCropUri(null)}
      />
      <AvatarViewerModal
        visible={viewerOpen}
        imageUri={profile.avatar_url}
        handle={profile.handle}
        onClose={() => setViewerOpen(false)}
      />
    </View>
  );
}

function btnBg(st: FriendshipStatus, accentBg: string, ghostBg: string) {
  return st === 'none' || st === 'pending_incoming'
    ? { backgroundColor: accentBg }
    : { backgroundColor: ghostBg };
}
function btnFg(st: FriendshipStatus) {
  return st === 'none' || st === 'pending_incoming' ? styles.btnTextAccent : styles.btnTextGhost;
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', paddingTop: 24, paddingBottom: 16, gap: 8 },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: { marginTop: 4 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  btn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, minWidth: 110, alignItems: 'center' },
  btnText: { fontSize: 14, fontWeight: '600' },
  btnTextAccent: { color: '#fff' },
  btnTextGhost: { opacity: 0.7 },
  overflow: { padding: 4 },
});
