// Full-page color picker: a true HSV wheel (intuitive free-form selection) plus
// a brightness slider and the curated palette swatches. The caller's live
// `preview` sits at the top, above the wheel, so the user sees their pill change
// as they drag — no need to keep the form behind visible. Updates `onChange`
// live. Pure color math lives in `lib/color-wheel.ts`; slider in
// `brightness-slider`.

import { type ReactNode, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrightnessSlider } from '@/components/brightness-slider';
import { ColorWheel } from '@/components/color-wheel';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Palette } from '@/constants/colors';
import { hexToHsv, hsvToHex, type Hsv } from '@/lib/color-wheel';

const PRESETS = Palette.habitColors;
const WHEEL = 240;

type Props = {
  visible: boolean;
  value: string;
  onChange: (hex: string) => void;
  onClose: () => void;
  // Rendered at the top of the page, above the wheel — typically a live preview
  // of whatever the color applies to, so the user sees it change as they drag.
  preview?: ReactNode;
};

export function ColorPickerModal({ visible, value, onChange, onClose, preview }: Props) {
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value));

  // Re-seed from the incoming color each time the page opens.
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
      presentationStyle="fullScreen"
      onRequestClose={onClose}>
      <ThemedView style={styles.root}>
        <SafeAreaView edges={['top']} style={styles.content}>
          <View style={styles.header}>
            <ThemedText type="defaultSemiBold">Color</ThemedText>
            <Pressable onPress={onClose} hitSlop={12}>
              <ThemedText style={styles.done}>Done</ThemedText>
            </Pressable>
          </View>

          {preview}

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
