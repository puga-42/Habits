// "Color" detail page (pushed from the habit form's Color row — a real page,
// not a modal, so the header is always reachable). Swatches-first: the live
// pill preview up top, then the garden presets plus a rainbow wheel-swatch of
// the same size that expands the free-form HSV wheel + brightness slider.
// The wheel always starts minimized; the wheel-swatch shows the selected ring
// when the current color is off-ramp. Reads/writes the shared habit draft.

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrightnessSlider } from '@/components/brightness-slider';
import { ColorWheel } from '@/components/color-wheel';
import { ColorWheelIcon } from '@/components/color-wheel-icon';
import { HabitPillPreview } from '@/components/habit-pill-preview';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Palette } from '@/constants/colors';
import { useTokens } from '@/hooks/use-tokens';
import { hexToHsv, hsvToHex, isPresetColor, type Hsv } from '@/lib/color-wheel';
import { useHabitForm } from '@/lib/habit-form';

const PRESETS = Palette.habitColors;
const WHEEL = 220;
const SWATCH = 52;
const SWATCH_RING = 3;

export default function ColorScreen() {
  const router = useRouter();
  const { draft, update } = useHabitForm();
  const t = useTokens();

  const current = draft.color ?? Palette.habitColors[0];
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(current));
  const [wheelOpen, setWheelOpen] = useState(false);

  function emit(next: Hsv) {
    setHsv(next);
    update({ color: hsvToHex(next.h, next.s, next.v) });
  }

  function pickPreset(hex: string) {
    setHsv(hexToHsv(hex));
    update({ color: hex });
  }

  const customSelected = !isPresetColor(current, PRESETS);

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.content}>
        <View style={[styles.header, { borderBottomColor: t.hairlineStrong }]}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ThemedText style={styles.headerButton}>‹ Back</ThemedText>
          </Pressable>
          <ThemedText type="defaultSemiBold">Color</ThemedText>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ThemedText style={[styles.headerButton, styles.done, { color: t.accent }]}>
              Done
            </ThemedText>
          </Pressable>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled">
          <HabitPillPreview />

          <View style={styles.presets}>
            {PRESETS.map((c) => {
              const selected = current.toUpperCase() === c.toUpperCase();
              return (
                <Pressable
                  key={c}
                  onPress={() => pickPreset(c)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Color ${c}`}
                  style={[
                    styles.swatch,
                    { backgroundColor: c },
                    selected && [styles.swatchSelected, { borderColor: t.ink }],
                  ]}
                />
              );
            })}
            {/* The 9th swatch: the rainbow wheel, same size as the presets. */}
            <Pressable
              onPress={() => setWheelOpen((o) => !o)}
              accessibilityRole="button"
              accessibilityState={{ expanded: wheelOpen, selected: customSelected }}
              accessibilityLabel="Custom color wheel"
              style={[
                styles.swatch,
                styles.wheelSwatch,
                customSelected && [styles.swatchSelected, { borderColor: t.ink }],
              ]}>
              <ColorWheelIcon size={SWATCH - SWATCH_RING * 2} />
            </Pressable>
          </View>

          {wheelOpen && (
            <>
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
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
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
  },
  headerButton: { fontSize: 16 },
  done: { fontWeight: '600' },
  presets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 8,
  },
  swatch: {
    width: SWATCH,
    height: SWATCH,
    borderRadius: SWATCH / 2,
    borderWidth: SWATCH_RING,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelSwatch: { overflow: 'hidden' },
  swatchSelected: {
    transform: [{ scale: 1.1 }],
  },
  wheelArea: { alignItems: 'center', paddingTop: 12 },
});
