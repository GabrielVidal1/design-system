import { describe, expect, it } from 'vitest';

import {
  generatePalette,
  hexToHsl,
  hexToRgb,
  hslToHex,
  isValidHex,
  luminance,
  normalizeHex,
  readableTextColor,
  rgbToHex,
} from './color';

const dist = (a: string, b: string) => {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return Math.abs(x.r - y.r) + Math.abs(x.g - y.g) + Math.abs(x.b - y.b);
};

describe('hex ⇄ hsl round-trip', () => {
  it('preserves the pure primaries exactly', () => {
    for (const hex of ['#ff0000', '#00ff00', '#0000ff', '#ffffff', '#000000']) {
      expect(hslToHex(hexToHsl(hex))).toBe(hex);
    }
  });

  it('stays close for arbitrary colours (HSL is integer-quantised)', () => {
    for (const hex of ['#123456', '#abcdef', '#7f3ec2']) {
      // A trip through integer HSL loses a few units per channel, never more.
      expect(dist(hslToHex(hexToHsl(hex)), hex)).toBeLessThanOrEqual(6);
    }
  });

  it('normalizeHex is lossless (no HSL trip)', () => {
    expect(normalizeHex('#123456')).toBe('#123456');
    expect(normalizeHex('#ABCDEF')).toBe('#abcdef');
  });

  it('expands short hex', () => {
    expect(normalizeHex('#f00')).toBe('#ff0000');
    expect(normalizeHex('abc')).toBe('#aabbcc');
  });

  it('drops the alpha channel', () => {
    expect(normalizeHex('#112233ff')).toBe('#112233');
  });

  it('rgbToHex clamps out-of-range channels', () => {
    expect(rgbToHex(300, -5, 128)).toBe('#ff0080');
  });
});

describe('luminance / readable text', () => {
  it('white is bright, black is dark', () => {
    expect(luminance('#ffffff')).toBeCloseTo(1, 2);
    expect(luminance('#000000')).toBeCloseTo(0, 2);
  });

  it('picks a legible foreground', () => {
    expect(readableTextColor('#ffffff')).toBe('#000000');
    expect(readableTextColor('#000000')).toBe('#ffffff');
    expect(readableTextColor('#1c1917')).toBe('#ffffff');
  });
});

describe('isValidHex', () => {
  it('accepts 3- and 6-digit, with or without #', () => {
    expect(isValidHex('#abc')).toBe(true);
    expect(isValidHex('aabbcc')).toBe(true);
    expect(isValidHex('#a1b2c3')).toBe(true);
  });
  it('rejects nonsense', () => {
    expect(isValidHex('#12')).toBe(false);
    expect(isValidHex('nothex')).toBe(false);
    expect(isValidHex('#1234')).toBe(false);
  });
});

describe('generatePalette', () => {
  it('produces the requested count within [1,12]', () => {
    expect(generatePalette({ count: 5, seed: 1 })).toHaveLength(5);
    expect(generatePalette({ count: 0, seed: 1 })).toHaveLength(1);
    expect(generatePalette({ count: 99, seed: 1 })).toHaveLength(12);
  });

  it('is deterministic for a fixed seed + harmony', () => {
    const a = generatePalette({ count: 4, seed: 42, harmony: 'triadic' });
    const b = generatePalette({ count: 4, seed: 42, harmony: 'triadic' });
    expect(a).toEqual(b);
  });

  it('yields only valid hex colours', () => {
    for (const hex of generatePalette({ count: 6, seed: 7, harmony: 'analogous' })) {
      expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('different seeds give different palettes', () => {
    const a = generatePalette({ count: 5, seed: 1, harmony: 'complementary' });
    const b = generatePalette({ count: 5, seed: 2, harmony: 'complementary' });
    expect(a).not.toEqual(b);
  });
});
