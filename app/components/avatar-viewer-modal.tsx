import { Image } from 'expo-image';
import { Dimensions, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle, useSharedValue, withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useTokens } from '@/hooks/use-tokens';

const { width: SCREEN_W } = Dimensions.get('window');
const AVATAR_SIZE = 280;
const AVATAR_R = AVATAR_SIZE / 2;
const MAX_SCALE = 4;

type Props = {
  visible: boolean;
  imageUri: string | null;
  handle: string;
  onClose: () => void;
};

export function AvatarViewerModal({ visible, imageUri, handle, onClose }: Props) {
  const t = useTokens();
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedScale = useSharedValue(1);
  const savedTX = useSharedValue(0);
  const savedTY = useSharedValue(0);

  const resetTransform = () => {
    'worklet';
    scale.value = withTiming(1, { duration: 200 });
    translateX.value = withTiming(0, { duration: 200 });
    translateY.value = withTiming(0, { duration: 200 });
    savedScale.value = 1;
    savedTX.value = 0;
    savedTY.value = 0;
  };

  const clamp = (tx: number, ty: number, s: number) => {
    'worklet';
    const hw = Math.max(0, (AVATAR_SIZE * s - SCREEN_W) / 2);
    const hh = Math.max(0, (AVATAR_SIZE * s - AVATAR_SIZE) / 2);
    return { x: Math.max(-hw, Math.min(hw, tx)), y: Math.max(-hh, Math.min(hh, ty)) };
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => { scale.value = Math.min(MAX_SCALE, Math.max(1, savedScale.value * e.scale)); })
    .onEnd(() => {
      savedScale.value = scale.value;
      const c = clamp(translateX.value, translateY.value, scale.value);
      translateX.value = withTiming(c.x, { duration: 150 });
      translateY.value = withTiming(c.y, { duration: 150 });
      savedTX.value = c.x;
      savedTY.value = c.y;
    });

  const pan = Gesture.Pan()
    .minPointers(1)
    .onUpdate((e) => {
      translateX.value = savedTX.value + e.translationX;
      translateY.value = savedTY.value + e.translationY;
    })
    .onEnd(() => {
      const c = clamp(translateX.value, translateY.value, scale.value);
      translateX.value = withTiming(c.x, { duration: 150 });
      translateY.value = withTiming(c.y, { duration: 150 });
      savedTX.value = c.x;
      savedTY.value = c.y;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1.1) {
        resetTransform();
      } else {
        scale.value = withTiming(2, { duration: 250 });
        savedScale.value = 2;
      }
    });

  const composed = Gesture.Simultaneous(pan, pinch, doubleTap);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  if (!visible) return null;

  const initial = (handle || '?').trim().charAt(0).toUpperCase();

  return (
    <Modal visible animationType="fade" transparent testID="avatar-viewer-root">
      <Pressable style={st.backdrop} onPress={onClose} testID="avatar-viewer-backdrop">
        <Pressable style={st.closeBtn} onPress={onClose} hitSlop={12} testID="avatar-viewer-close">
          <IconSymbol name="xmark" color="#fff" size={22} />
        </Pressable>

        {imageUri ? (
          <GestureDetector gesture={composed}>
            <Animated.View style={[st.avatarWrap, animStyle]}>
              <Image
                source={{ uri: imageUri }}
                style={st.avatar}
                contentFit="cover"
                testID="avatar-viewer-image"
              />
            </Animated.View>
          </GestureDetector>
        ) : (
          <View style={[st.fallback, { backgroundColor: t.ink45 }]}>
            <ThemedText style={st.initial}>{initial}</ThemedText>
          </View>
        )}
      </Pressable>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  closeBtn: { position: 'absolute', top: 60, left: 20, zIndex: 10, padding: 8 },
  avatarWrap: { width: AVATAR_SIZE, height: AVATAR_SIZE },
  avatar: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_R },
  fallback: {
    width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_R,
    alignItems: 'center', justifyContent: 'center',
  },
  initial: { color: '#fff', fontSize: AVATAR_SIZE * 0.4, fontWeight: '700' },
});
