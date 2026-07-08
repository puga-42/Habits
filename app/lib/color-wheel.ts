// Pure color math backing the custom HSV color wheel (no picker dependency —
// the wheel renders with react-native-svg and these helpers convert between
// hex, HSV, and wheel geometry). Kept side-effect-free so it can be tested
// without mocks.
//
// Wheel convention: angle around the wheel is hue (0° = red at the 3-o'clock
// position, increasing counter-clockwise), distance from the center is
// saturation (0 at center, 1 at the rim). Screen space has y pointing down,
// so the geometry helpers negate y.

export type Hsv = { h: number; s: number; v: number };

// h in [0,360), s & v in [0,1] → "#RRGGBB" (uppercase).
export function hsvToHex(h: number, s: number, v: number): string {
  const hp = ((((h % 360) + 360) % 360) / 60);
  const c = v * s;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = v - c;
  const hex = (n: number) =>
    Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`.toUpperCase();
}

// "#RRGGBB" (case-insensitive, optional leading #) → HSV.
export function hexToHsv(hex: string): Hsv {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}

// Offset from the wheel center (dx, dy in screen space) → hue + saturation.
export function polarToHueSat(dx: number, dy: number, radius: number): { h: number; s: number } {
  const dist = Math.sqrt(dx * dx + dy * dy);
  const s = radius <= 0 ? 0 : Math.min(dist / radius, 1);
  let h = (Math.atan2(-dy, dx) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { h, s };
}

// Hue + saturation → offset from the wheel center (screen space). Inverse of
// polarToHueSat; used to place the selection thumb.
export function hueSatToXY(h: number, s: number, radius: number): { x: number; y: number } {
  const rad = (h * Math.PI) / 180;
  return { x: Math.cos(rad) * s * radius, y: -Math.sin(rad) * s * radius };
}

// Is `hex` one of the curated preset swatches (case-insensitive)? The color
// picker opens with the custom wheel expanded only for off-ramp colors, so
// existing custom-colored habits stay directly editable while the garden
// swatches remain the default path (see PLAN.md "UI overhaul", slice 3).
export function isPresetColor(
  hex: string | null,
  presets: readonly string[],
): boolean {
  if (!hex) return false;
  const target = hex.toUpperCase();
  return presets.some((p) => p.toUpperCase() === target);
}
