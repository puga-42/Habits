import {
  hexToHsv,
  hsvToHex,
  hueSatToXY,
  polarToHueSat,
} from '../color-wheel';

describe('hsvToHex', () => {
  it('maps primary hues at full saturation/value', () => {
    expect(hsvToHex(0, 1, 1)).toBe('#FF0000');
    expect(hsvToHex(120, 1, 1)).toBe('#00FF00');
    expect(hsvToHex(240, 1, 1)).toBe('#0000FF');
  });

  it('maps white, black, and mid gray', () => {
    expect(hsvToHex(0, 0, 1)).toBe('#FFFFFF');
    expect(hsvToHex(0, 0, 0)).toBe('#000000');
    expect(hsvToHex(200, 0, 0.5)).toBe('#808080');
  });

  it('normalizes hue outside [0,360)', () => {
    expect(hsvToHex(360, 1, 1)).toBe('#FF0000');
    expect(hsvToHex(-120, 1, 1)).toBe('#0000FF');
  });
});

describe('hexToHsv', () => {
  it('reads primary colors back to hue/sat/value', () => {
    expect(hexToHsv('#FF0000')).toEqual({ h: 0, s: 1, v: 1 });
    const green = hexToHsv('#00FF00');
    expect(green.h).toBeCloseTo(120);
    expect(green.s).toBe(1);
    expect(green.v).toBe(1);
  });

  it('reads white as zero saturation', () => {
    const white = hexToHsv('#FFFFFF');
    expect(white.s).toBe(0);
    expect(white.v).toBe(1);
  });

  it('tolerates lowercase and missing #', () => {
    expect(hexToHsv('0000ff')).toEqual({ h: 240, s: 1, v: 1 });
  });
});

describe('hsv/hex round trip', () => {
  it('round-trips a palette color within rounding tolerance', () => {
    const original = '#A78BFA';
    const { h, s, v } = hexToHsv(original);
    expect(hsvToHex(h, s, v)).toBe(original);
  });
});

describe('polarToHueSat', () => {
  it('reports zero saturation at the center', () => {
    expect(polarToHueSat(0, 0, 50).s).toBe(0);
  });

  it('reports full saturation at the rim and clamps beyond it', () => {
    expect(polarToHueSat(50, 0, 50).s).toBe(1);
    expect(polarToHueSat(100, 0, 50).s).toBe(1);
  });

  it('maps the 3-o-clock direction to hue 0 and straight up to hue 90', () => {
    expect(polarToHueSat(50, 0, 50).h).toBeCloseTo(0);
    // Screen space: "up" is negative dy.
    expect(polarToHueSat(0, -50, 50).h).toBeCloseTo(90);
  });
});

describe('hueSatToXY', () => {
  it('inverts polarToHueSat', () => {
    const { x, y } = hueSatToXY(90, 1, 50);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(-50);
    const back = polarToHueSat(x, y, 50);
    expect(back.h).toBeCloseTo(90);
    expect(back.s).toBeCloseTo(1);
  });
});
