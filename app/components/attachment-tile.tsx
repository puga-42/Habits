import { Image } from 'expo-image';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { AttachmentDetail } from '@/lib/completions';

type Props = {
  attachment: AttachmentDetail;
  signedUrl?: string;
  onDelete?: () => void;
  isActive?: boolean;
};

export function AttachmentTile({ attachment, signedUrl, onDelete, isActive }: Props) {
  const [pressed, setPressed] = useState(false);

  const handleLongPress = () => {
    if (!onDelete) return;
    Alert.alert(
      'Delete attachment?',
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onDelete },
      ],
    );
  };

  return (
    <Pressable
      onLongPress={handleLongPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[
        styles.tile,
        pressed && styles.tilePressed,
        isActive && styles.tileActive,
      ]}
    >
      {signedUrl ? (
        <Image source={{ uri: signedUrl }} style={styles.image} contentFit="cover" />
      ) : (
        <View style={styles.placeholder}>
          <ThemedText style={styles.placeholderIcon}>
            {attachment.kind === 'photo' ? '📷' : '🎥'}
          </ThemedText>
        </View>
      )}
      {attachment.kind === 'video' && attachment.duration_seconds != null && (
        <View style={styles.durationBadge}>
          <ThemedText style={styles.durationText}>
            {formatDuration(attachment.duration_seconds)}
          </ThemedText>
        </View>
      )}
    </Pressable>
  );
}

type AddTileProps = {
  onPress: () => void;
};

export function AddTile({ onPress }: AddTileProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tile, styles.addTile, pressed && styles.tilePressed]}>
      <ThemedText style={styles.addIcon}>+</ThemedText>
      <ThemedText style={styles.addLabel}>add</ThemedText>
    </Pressable>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  tile: {
    width: 100,
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(127,127,127,0.12)',
  },
  tilePressed: { opacity: 0.7 },
  tileActive: { opacity: 0.8, transform: [{ scale: 1.05 }] },
  image: { width: '100%', height: '100%' },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: { fontSize: 32 },
  durationBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  durationText: { fontSize: 11, color: '#fff', fontWeight: '600' },
  addTile: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(127,127,127,0.3)',
    borderStyle: 'dashed',
  },
  addIcon: { fontSize: 28, opacity: 0.5 },
  addLabel: { fontSize: 12, opacity: 0.5, marginTop: 2 },
});
