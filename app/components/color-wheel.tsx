// A self-contained HSV color wheel rendered with react-native-svg (no picker
// dependency). Hue runs around the wheel, saturation from center to rim. The
// brightness (value) only darkens the preview/output — the wheel itself is
// drawn at full value with a translucent black overlay so lower brightness
// reads as a dimmer wheel. Touches are tracked with React Native's responder
// system; the math lives in `lib/color-wheel.ts`.

import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Polygon, RadialGradient, Stop } from 'react-native-svg';

import { hsvToHex, hueSatToXY, polarToHueSat } from '@/lib/color-wheel';

const SEGMENTS = 120;
const THUMB = 22;

type Props = {
  hue: number;
  sat: number;
  value: number;
  size: number;
  onChange: (h: number, s: number) => void;
};

export function ColorWheel({ hue, sat, value, size, onChange }: Props) {
  const radius = size / 2;

  function handleTouch(locationX: number, locationY: number) {
    const { h, s } = polarToHueSat(locationX - radius, locationY - radius, radius);
    onChange(h, s);
  }

  const thumb = hueSatToXY(hue, sat, radius);

  return (
    <View
      style={{ width: size, height: size }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => handleTouch(e.nativeEvent.locationX, e.nativeEvent.locationY)}
      onResponderMove={(e) => handleTouch(e.nativeEvent.locationX, e.nativeEvent.locationY)}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="sat" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#fff" stopOpacity={1} />
            <Stop offset="1" stopColor="#fff" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        {Array.from({ length: SEGMENTS }, (_, i) => {
          const h0 = (i / SEGMENTS) * 360;
          const h1 = ((i + 1) / SEGMENTS) * 360;
          const p0 = hueSatToXY(h0, 1, radius);
          const p1 = hueSatToXY(h1, 1, radius);
          return (
            <Polygon
              key={i}
              points={`${radius},${radius} ${radius + p0.x},${radius + p0.y} ${radius + p1.x},${radius + p1.y}`}
              fill={hsvToHex(h0, 1, 1)}
            />
          );
        })}
        <Circle cx={radius} cy={radius} r={radius} fill="url(#sat)" />
        {value < 1 && (
          <Circle cx={radius} cy={radius} r={radius} fill="#000" opacity={1 - value} />
        )}
      </Svg>
      <View
        pointerEvents="none"
        style={[
          styles.thumb,
          {
            left: radius + thumb.x - THUMB / 2,
            top: radius + thumb.y - THUMB / 2,
            backgroundColor: hsvToHex(hue, sat, value),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
});
