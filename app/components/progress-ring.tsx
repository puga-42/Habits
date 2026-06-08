import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

type Props = {
  size: number;
  strokeWidth: number;
  fraction: number;
  color: string;
  trackColor?: string;
  children?: ReactNode;
};

export function ProgressRing({
  size,
  strokeWidth,
  fraction,
  color,
  trackColor = 'rgba(127,127,127,0.25)',
  children,
}: Props) {
  const half = size / 2;
  const f = Math.max(0, Math.min(1, fraction));

  const rightAngle = f <= 0.5 ? -180 + f * 360 : 0;
  const leftAngle = f <= 0.5 ? -180 : -180 + (f - 0.5) * 360;

  return (
    <View style={[styles.outer, { width: size, height: size }]}>
      {/* Track */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: half, borderWidth: strokeWidth, borderColor: trackColor },
        ]}
      />

      {/* Right half (0–50%) */}
      <View
        style={[
          styles.clip,
          { top: 0, left: half, width: half, height: size },
        ]}>
        <View
          style={{
            width: size,
            height: size,
            marginLeft: -half,
            borderRadius: half,
            borderWidth: strokeWidth,
            borderColor: 'transparent',
            borderTopColor: color,
            borderRightColor: color,
            transform: [{ rotate: `${rightAngle}deg` }],
          }}
        />
      </View>

      {/* Left half (50–100%) */}
      <View style={[styles.clip, { top: 0, left: 0, width: half, height: size }]}>
        <View
          style={{
            width: size,
            height: size,
            borderRadius: half,
            borderWidth: strokeWidth,
            borderColor: 'transparent',
            borderBottomColor: color,
            borderLeftColor: color,
            transform: [{ rotate: `${leftAngle}deg` }],
          }}
        />
      </View>

      {/* Content */}
      <View style={[StyleSheet.absoluteFill, styles.center, { transform: [{ rotate: '45deg' }] }]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { transform: [{ rotate: '-45deg' }] },
  clip: { position: 'absolute', overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center' },
});
