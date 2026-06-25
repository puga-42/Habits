// Horizontal brightness (HSV value) slider for the color picker: black → the
// fully-bright version of the current hue/saturation. Emits live as it's dragged.

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { hsvToHex, type Hsv } from '@/lib/color-wheel';

const SLIDER_H = 28;

export function BrightnessSlider({
  hsv,
  onChange,
}: {
  hsv: Hsv;
  onChange: (v: number) => void;
}) {
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
  slider: {
    height: SLIDER_H,
    marginHorizontal: 24,
    marginTop: 24,
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
});
