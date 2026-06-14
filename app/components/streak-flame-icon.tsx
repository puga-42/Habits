// Solid flame glyph for the streak badge, drawn so a number can sit legibly on
// top of it (the multicolor 🔥 emoji can't be reliably overlaid). A single
// closed path filled with a warm vertical gradient — bright at the tip, deep
// red at the base — gives the streak number a solid, high-contrast backing.
// Built on the already-installed react-native-svg, matching ColorWheelIcon.

import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

// Lucide "flame" outline, filled as a solid silhouette (one subpath, so it
// fills without a hole).
const FLAME_PATH =
  'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 ' +
  '.5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3' +
  'a2.5 2.5 0 0 0 2.5 2.5z';

export function StreakFlameIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <LinearGradient id="streak-flame" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0" stopColor="#FFC24B" />
          <Stop offset="0.5" stopColor="#FF7A1A" />
          <Stop offset="1" stopColor="#F4380A" />
        </LinearGradient>
      </Defs>
      <Path d={FLAME_PATH} fill="url(#streak-flame)" />
    </Svg>
  );
}
