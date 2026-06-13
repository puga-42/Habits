// A small, static rainbow color-wheel glyph used as the entry point to the
// color picker, so it's obvious the control opens a color chooser. Hue runs
// around the ring and fades to a white center (saturation), the same look as
// the full wheel. Reuses the pure geometry/color helpers in `lib/color-wheel.ts`.

import Svg, { Circle, Defs, Polygon, RadialGradient, Stop } from 'react-native-svg';

import { hsvToHex, hueSatToXY } from '@/lib/color-wheel';

const SEGMENTS = 36;

export function ColorWheelIcon({ size }: { size: number }) {
  const r = size / 2;
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id="wheel-icon-sat" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#fff" stopOpacity={1} />
          <Stop offset="1" stopColor="#fff" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      {Array.from({ length: SEGMENTS }, (_, i) => {
        const h0 = (i / SEGMENTS) * 360;
        const h1 = ((i + 1) / SEGMENTS) * 360;
        const p0 = hueSatToXY(h0, 1, r);
        const p1 = hueSatToXY(h1, 1, r);
        return (
          <Polygon
            key={i}
            points={`${r},${r} ${r + p0.x},${r + p0.y} ${r + p1.x},${r + p1.y}`}
            fill={hsvToHex(h0, 1, 1)}
          />
        );
      })}
      <Circle cx={r} cy={r} r={r} fill="url(#wheel-icon-sat)" />
    </Svg>
  );
}
