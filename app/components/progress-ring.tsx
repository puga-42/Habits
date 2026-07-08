import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useTokens } from '@/hooks/use-tokens';

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
  trackColor,
  children,
}: Props) {
  const t = useTokens();
  const f = Math.max(0, Math.min(1, fraction));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - f);

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor ?? t.hairlineStrong}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {f > 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            rotation={-90}
            origin={`${size / 2}, ${size / 2}`}
          />
        )}
      </Svg>
      {children && (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          {children}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
