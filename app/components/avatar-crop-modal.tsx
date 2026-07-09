import { Paths, File as ExpoFile } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Dimensions, Image, Modal, Pressable, StyleSheet, View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle, useSharedValue, withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import type { CropParams } from '@/lib/profile';
import { errorMessage } from '@/lib/error-message';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const CROP_SIZE = 280;
const CROP_R = CROP_SIZE / 2;
const OV = 'rgba(0,0,0,0.55)';
const CIRCLE_TOP = SCREEN_H / 2 - CROP_R;
const CIRCLE_LEFT = SCREEN_W / 2 - CROP_R;

type Props = {
  visible: boolean;
  imageUri: string | null;
  initialCropParams?: CropParams | null;
  onSave: (croppedUri: string, cropParams: CropParams) => void;
  onCancel: () => void;
};

export function AvatarCropModal({ visible, imageUri, initialCropParams, onSave, onCancel }: Props) {
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedScale = useSharedValue(1);
  const savedTX = useSharedValue(0);
  const savedTY = useSharedValue(0);

  useEffect(() => {
    if (!visible || !imageUri) return;
    const s = initialCropParams?.scale ?? 1;
    const tx = initialCropParams?.translateX ?? 0;
    const ty = initialCropParams?.translateY ?? 0;
    scale.value = s; translateX.value = tx; translateY.value = ty;
    savedScale.value = s; savedTX.value = tx; savedTY.value = ty;
    setImgSize(null); setSaving(false);
    Image.getSize(imageUri, (w, h) => setImgSize({ w, h }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- shared values are stable refs
  }, [visible, imageUri]);

  const baseScale = imgSize ? CROP_SIZE / Math.min(imgSize.w, imgSize.h) : 1;
  const dispW = imgSize ? imgSize.w * baseScale : 0;
  const dispH = imgSize ? imgSize.h * baseScale : 0;

  const clampTranslation = (tx: number, ty: number, s: number) => {
    'worklet';
    const hw = Math.max(0, (dispW * s - CROP_SIZE) / 2);
    const hh = Math.max(0, (dispH * s - CROP_SIZE) / 2);
    return { x: Math.max(-hw, Math.min(hw, tx)), y: Math.max(-hh, Math.min(hh, ty)) };
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => { scale.value = Math.max(1, savedScale.value * e.scale); })
    .onEnd(() => {
      savedScale.value = scale.value;
      const c = clampTranslation(translateX.value, translateY.value, scale.value);
      translateX.value = withTiming(c.x, { duration: 150 });
      translateY.value = withTiming(c.y, { duration: 150 });
      savedTX.value = c.x; savedTY.value = c.y;
    });

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = savedTX.value + e.translationX;
      translateY.value = savedTY.value + e.translationY;
    })
    .onEnd(() => {
      const c = clampTranslation(translateX.value, translateY.value, scale.value);
      translateX.value = withTiming(c.x, { duration: 150 });
      translateY.value = withTiming(c.y, { duration: 150 });
      savedTX.value = c.x; savedTY.value = c.y;
    });

  const gesture = Gesture.Simultaneous(pan, pinch);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const handleSave = async () => {
    if (!imgSize || !imageUri) return;
    setSaving(true);
    try {
      let localUri = imageUri;
      if (imageUri.startsWith('http')) {
        const resp = await fetch(imageUri);
        const buf = await resp.arrayBuffer();
        const cached = new ExpoFile(Paths.cache, 'avatar-crop-source.jpg');
        await cached.write(new Uint8Array(buf));
        localUri = cached.uri;
      }
      const s = savedScale.value;
      const tx = savedTX.value;
      const ty = savedTY.value;
      const cropSizeInImg = CROP_SIZE / (baseScale * s);
      const cx = imgSize.w / 2 - tx / (baseScale * s);
      const cy = imgSize.h / 2 - ty / (baseScale * s);
      const originX = Math.max(0, Math.round(cx - cropSizeInImg / 2));
      const originY = Math.max(0, Math.round(cy - cropSizeInImg / 2));
      const cropW = Math.min(Math.round(cropSizeInImg), imgSize.w - originX);
      const cropH = Math.min(Math.round(cropSizeInImg), imgSize.h - originY);

      const result = await manipulateAsync(
        localUri,
        [
          { crop: { originX, originY, width: cropW, height: cropH } },
          { resize: { width: 500, height: 500 } },
        ],
        { compress: 0.8, format: SaveFormat.JPEG },
      );
      onSave(result.uri, { scale: s, translateX: tx, translateY: ty });
    } catch (err) {
      Alert.alert('Could not save', errorMessage(err));
      setSaving(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible animationType="fade" transparent>
      <View style={st.root}>
        {imgSize ? (
          <GestureDetector gesture={gesture}>
            <Animated.View style={[st.imgWrap, animStyle]}>
              <Animated.Image
                source={{ uri: imageUri! }}
                style={{ width: dispW, height: dispH }}
                resizeMode="cover"
              />
            </Animated.View>
          </GestureDetector>
        ) : (
          <ActivityIndicator color="#fff" />
        )}

        <CropOverlay />

        <View style={st.buttons}>
          <Pressable onPress={onCancel} disabled={saving} hitSlop={12}>
            <ThemedText style={st.btnText}>Cancel</ThemedText>
          </Pressable>
          <Pressable onPress={handleSave} disabled={saving || !imgSize} hitSlop={12}>
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <ThemedText style={st.btnText}>Save</ThemedText>}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const OVERLAY_BORDER = Math.max(SCREEN_W, SCREEN_H);

function CropOverlay() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View
        style={{
          position: 'absolute',
          top: SCREEN_H / 2 - CROP_R - OVERLAY_BORDER,
          left: SCREEN_W / 2 - CROP_R - OVERLAY_BORDER,
          width: CROP_SIZE + OVERLAY_BORDER * 2,
          height: CROP_SIZE + OVERLAY_BORDER * 2,
          borderRadius: CROP_R + OVERLAY_BORDER,
          borderWidth: OVERLAY_BORDER,
          borderColor: OV,
        }}
      />
      <View style={st.ring} />
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  imgWrap: { position: 'absolute' },
  ring: {
    position: 'absolute',
    top: CIRCLE_TOP,
    left: CIRCLE_LEFT,
    width: CROP_SIZE,
    height: CROP_SIZE,
    borderRadius: CROP_R,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  buttons: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
  },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '600' },
});
