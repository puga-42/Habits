// Ember — the app's brand sheet (UI overhaul slice 1; see PLAN.md).
// Warm plum-charcoal ground, ONE ember-coral accent, warm ink whose alphas
// build all text hierarchy, honey reserved for streaks, green for done.
// Semantic tokens live in theme.ts (Tokens; read via useTokens()) — this file
// holds only the raw Ember values that feed them, the deliberate hue sheet
// (Palette), and the pure tint helpers.

// ─── Raw Ember values ────────────────────────────────────────────────────────

export const Ember = {
  // Ground (dark scheme)
  plum: '#211D24', // app background
  plumSurface: '#2A2530', // cards, sheets
  plumRaised: '#332D3A', // inputs, chips

  // Ground (light scheme — "Sunrise", fully QA'd in slice 6)
  paper: '#F7F3EE',
  paperSurface: '#FFFFFF',
  paperRaised: '#EFE8E1',

  // Ink
  ink: '#F4EFEA', // warm off-white, dark scheme text
  inkLight: '#2A2428', // light scheme text

  // The one brand accent
  coral: '#FF8E62', // dark scheme accent
  coralDeep: '#B84A22', // light scheme accent / pressed (AA on paper+white)
  coralSoft: '#FFB794',
  onCoral: '#2A1608',

  // Semantic hues
  honey: '#FFC24B', // streaks ONLY
  leaf: '#63C58A', // success / done
  flame: '#F2695C', // danger / destructive
} as const;

// ─── Hue sheet ───────────────────────────────────────────────────────────────
// Deliberate color CHOICES, not roles — roles live in theme.ts Tokens (read
// them via useTokens()). The slice-1 legacy aliases (primary, charcoal, …)
// were deleted in slice 5.5; if you're looking for one, you want a token.

export const Palette = {
  // Garden periwinkle drives rests + the today cell; garden rose the blush
  // accents (friend-request chips, FAB actions).
  periwinkle: '#9A96E8',
  periwinkleDeep: '#5A54BA', // light-scheme "today" marker (AA on paper)
  periwinkleMuted: '#453E58',
  rose: '#EF8FA7',
  roseMuted: '#523F47',

  // The garden ramp — 8 hues, one saturation/brightness band, composed for
  // the plum ground. The picker defaults to these ([0] is the default habit
  // color); the HSV wheel sits behind the 9th wheel-swatch (slice 3).
  // Existing off-ramp colors keep rendering.
  habitColors: [
    '#FF8E62', // coral
    '#F0AE4A', // marigold
    '#9BC26B', // sage
    '#5BC4A6', // mint
    '#6FB4E8', // sky
    '#9A96E8', // periwinkle
    '#C48BD6', // orchid
    '#EF8FA7', // rose
  ],
} as const;

// Any hex color at an alpha — pair with a token at the call site so washes
// and soft fills follow the scheme: `withAlpha(t.accent, 0.18)`.
export function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Scheme grounds as RGB triples for blending — the single source solidTint
// mixes toward. MUST stay equal to Ember.plum / Ember.paper.
const GROUND_RGB = {
  dark: [33, 29, 36],
  light: [247, 243, 238],
} as const;

/** Blend `hex` toward the theme background at `amount` (0–1), returning a solid hex color. */
export function solidTint(hex: string, amount: number, isDark = true): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const [bgR, bgG, bgB] = GROUND_RGB[isDark ? 'dark' : 'light'];
  const outR = Math.round(bgR + amount * (r - bgR));
  const outG = Math.round(bgG + amount * (g - bgG));
  const outB = Math.round(bgB + amount * (b - bgB));
  return `#${outR.toString(16).padStart(2, '0')}${outG.toString(16).padStart(2, '0')}${outB.toString(16).padStart(2, '0')}`;
}
