// Bottom-sheet color picker: a true HSV wheel (intuitive free-form selection)
// plus a brightness slider and the curated palette swatches (the existing
// quick selection). Updates `onChange` live so the habit preview updates
// underneath. Pure color math lives in `lib/color-wheel.ts`.

import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { ColorWheel } from '@/components/color-wheel';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Palette } from '@/constants/colors';
import { hexToHsv, hsvToHex, type Hsv } from '@/lib/color-wheel';

const PRESETS = Palette.habitColors;
const WHEEL = 240;
const SLIDER_H = 28;

type Props = {
  visible: boolean;
  value: string;
  onChange: (hex: string) => void;
  onClose: () => void;
};

export function ColorPickerModal({ visible, value, onChange, onClose }: Props) {
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value));

  // Re-seed from the incoming color each time the sheet opens.
  useEffect(() => {
    if (visible) setHsv(hexToHsv(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function emit(next: Hsv) {
    setHsv(next);
    onChange(hsvToHex(next.h, next.s, next.v));
  }

  const current = hsvToHex(hsv.h, hsv.s, hsv.v);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <ThemedView style={styles.root}>
        <SafeAreaView edges={['top']} style={styles.content}>
          <View style={styles.header}>
            <ThemedText type="defaultSemiBold">Color</ThemedText>
            <Pressable onPress={onClose} hitSlop={12}>
              <ThemedText style={styles.done}>Done</ThemedText>
            </Pressable>
          </View>

          <View style={styles.wheelArea}>
            <ColorWheel
              hue={hsv.h}
              sat={hsv.s}
              value={hsv.v}
              size={WHEEL}
              onChange={(h, s) => emit({ h, s, v: hsv.v })}
            />
          </View>

          <BrightnessSlider hsv={hsv} onChange={(v) => emit({ ...hsv, v })} />

          <View style={styles.presets}>
            {PRESETS.map((c) => (
              <Pressable
                key={c}
                onPress={() => emit(hexToHsv(c))}
                accessibilityRole="button"
                accessibilityLabel={`Color ${c}`}
                style={[
                  styles.swatch,
                  { backgroundColor: c },
                  current.toUpperCase() === c.toUpperCase() && styles.swatchSelected,
                ]}
              />
            ))}
          </View>
        </SafeAreaView>
      </ThemedView>
    </Modal>
  );
}

function BrightnessSlider({ hsv, onChange }: { hsv: Hsv; onChange: (v: number) => void }) {
  const [width, setWidth] = useState(0);

  function handle(locationX: number) {
    if (width <= 0) return;
    onChange(Math.max(0, Math.min(1, locationX / width)));
  }

  const full = hsvToHex(hsv.h, hsv.s, 1);
  const thumbLeft = Math.max(0, Math.min(width - 24, hsv.v * width - 12));

  return (
    <View
      style={styles.slider}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => handle(e.nativeEvent.locationX)}
      onResponderMove={(e) => handle(e.nativeEvent.locationX)}>
      <Svg width={width || 1} height={SLIDER_H}>
        <Defs>
          <LinearGradient id="bright" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#000" />
            <Stop offset="1" stopColor={full} />
          </LinearGradient>
        </Defs>
        <Rect width={width || 1} height={SLIDER_H} rx={SLIDER_H / 2} fill="url(#bright)" />
      </Svg>
      <View pointerEvents="none" style={[styles.sliderThumb, { left: thumbLeft }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(127,127,127,0.25)',
  },
  done: { fontSize: 16, fontWeight: '600' },
  wheelArea: { alignItems: 'center', paddingTop: 28 },
  slider: {
    height: SLIDER_H,
    marginHorizontal: 24,
    marginTop: 28,
    justifyContent: 'center',
  },
  sliderThumb: {
    position: 'absolute',
    top: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#fff',
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  presets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchSelected: {
    borderColor: 'rgba(127,127,127,0.7)',
    transform: [{ scale: 1.12 }],
  },
});
