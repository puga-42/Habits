// Ember foundation (UI overhaul slice 1) — guards the semantic token system:
// scheme parity, value validity, legacy-alias coherence, and the tint helpers
// following the token ground. See PLAN.md "UI overhaul: Ember".

import { Ember, Palette, solidTint, withAlpha } from '../colors';
import { Colors, Tokens } from '../theme';

const HEX = /^#[0-9a-fA-F]{6}$/;
const RGBA = /^rgba\(\d{1,3},\s?\d{1,3},\s?\d{1,3},\s?(0|1|0?\.\d+)\)$/;

describe('Tokens', () => {
  it('light and dark define the same token keys', () => {
    expect(Object.keys(Tokens.light).sort()).toEqual(Object.keys(Tokens.dark).sort());
  });

  it('every token value is a valid hex or rgba color', () => {
    for (const scheme of ['light', 'dark'] as const) {
      for (const [key, value] of Object.entries(Tokens[scheme])) {
        const ok = HEX.test(value) || RGBA.test(value);
        if (!ok) throw new Error(`Tokens.${scheme}.${key} is not a valid color: ${value}`);
      }
    }
  });

  it('never uses the dead neutral gray the overhaul retires', () => {
    for (const scheme of ['light', 'dark'] as const) {
      for (const value of Object.values(Tokens[scheme])) {
        expect(value).not.toContain('127, 127, 127');
        expect(value).not.toContain('127,127,127');
      }
    }
  });

  it('the legacy Colors map derives entirely from the tokens (one source of truth)', () => {
    expect(Colors.dark.background).toBe(Tokens.dark.bg);
    expect(Colors.light.background).toBe(Tokens.light.bg);
    expect(Colors.dark.tint).toBe(Tokens.dark.accent);
    expect(Colors.dark.icon).toBe(Tokens.dark.ink52);
  });
});

describe('habitColors (garden ramp)', () => {
  it('has 8 unique valid hex swatches', () => {
    expect(Palette.habitColors).toHaveLength(8);
    expect(new Set(Palette.habitColors).size).toBe(8);
    for (const c of Palette.habitColors) expect(c).toMatch(HEX);
  });

  it('the first swatch is the brand coral — the default habit color', () => {
    expect(Palette.habitColors[0]).toBe(Ember.coral);
  });

  it('no swatch is a gray (every habit color has real chroma)', () => {
    for (const c of Palette.habitColors) {
      const r = parseInt(c.slice(1, 3), 16);
      const g = parseInt(c.slice(3, 5), 16);
      const b = parseInt(c.slice(5, 7), 16);
      const spread = Math.max(r, g, b) - Math.min(r, g, b);
      expect(spread).toBeGreaterThan(24);
    }
  });
});

describe('tint helpers follow the token ground', () => {
  it('withAlpha wraps any hex in an rgba at the given alpha', () => {
    expect(withAlpha('#FF8E62', 0.5)).toBe('rgba(255,142,98,0.5)');
    expect(withAlpha('#000000', 0.08)).toBe('rgba(0,0,0,0.08)');
  });

  it('solidTint at amount 1 returns the color itself', () => {
    expect(solidTint('#FF8E62', 1).toLowerCase()).toBe('#ff8e62');
  });

  it('solidTint at amount 0 lands exactly on the scheme background token', () => {
    expect(solidTint('#FF8E62', 0, true).toLowerCase()).toBe(Tokens.dark.bg.toLowerCase());
    expect(solidTint('#FF8E62', 0, false).toLowerCase()).toBe(Tokens.light.bg.toLowerCase());
  });
});

// ─── Sunrise guard (slice 6): AA contrast holds in BOTH schemes ─────────────
// Roles that render as text or meaningful marks must clear WCAG AA (4.5:1)
// against the grounds they sit on. This is what makes the light theme real —
// values can change, legibility can't.

function luminance(hex: string): number {
  const ch = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

describe('contrast (AA) holds in both schemes', () => {
  for (const scheme of ['light', 'dark'] as const) {
    const t = Tokens[scheme];
    const grounds: [string, string][] = [
      ['bg', t.bg],
      ['surface', t.surface],
    ];
    for (const [groundName, ground] of grounds) {
      it(`${scheme}: ink ≥ 7:1 on ${groundName}`, () => {
        expect(contrast(t.ink, ground)).toBeGreaterThanOrEqual(7);
      });
      for (const role of ['accent', 'streak', 'success', 'danger', 'today'] as const) {
        it(`${scheme}: ${role} ≥ 4.5:1 on ${groundName}`, () => {
          expect(contrast(t[role], ground)).toBeGreaterThanOrEqual(4.5);
        });
      }
    }
    it(`${scheme}: onAccent ≥ 4.5:1 on accent and on today`, () => {
      expect(contrast(t.onAccent, t.accent)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.onAccent, t.today)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
