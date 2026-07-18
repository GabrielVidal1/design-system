/*
 * Dependency-free colour math for the palette picker.
 *
 * Everything works on hex strings (`#rrggbb`) at the boundary and on HSL in the
 * middle, because colour-theory harmonies (complementary, analogous, triadic…)
 * are rotations in hue space. Kept tiny and pure so it stays tree-shakeable and
 * testable with no runtime deps.
 */

export interface HSL {
  /** 0–360 */
  h: number;
  /** 0–100 */
  s: number;
  /** 0–100 */
  l: number;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const mod360 = (h: number) => ((h % 360) + 360) % 360;
const round = (n: number) => Math.round(n);

/** Parse `#rgb`, `#rrggbb`, or `#rrggbbaa` (alpha dropped) into HSL. */
export function hexToHsl(hex: string): HSL {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHsl(r, g, b);
}

export function hslToHex({ h, s, l }: HSL): string {
  const { r, g, b } = hslToRgb(mod360(h), clamp(s, 0, 100), clamp(l, 0, 100));
  return rgbToHex(r, g, b);
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length === 8) h = h.slice(0, 6);
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return { r: 0, g: 0, b: 0 };
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const to = (v: number) => clamp(round(v), 0, 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

export function rgbToHsl(r: number, g: number, b: number): HSL {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h: mod360(h), s: round(s * 100), l: round(l * 100) };
}

export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h = mod360(h);
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

/** True if `#rrggbb` is a syntactically valid full or short hex colour. */
export function isValidHex(hex: string): boolean {
  return /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex.trim());
}

/** Normalise any accepted hex spelling to lowercase `#rrggbb` (alpha dropped),
 *  without a lossy trip through HSL. */
export function normalizeHex(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r, g, b);
}

/** WCAG relative luminance (0 = black, 1 = white). */
export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const lin = (v: number) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Pick black or white — whichever reads better on `bg`. */
export function readableTextColor(bg: string): '#000000' | '#ffffff' {
  return luminance(bg) > 0.4 ? '#000000' : '#ffffff';
}

export type Harmony =
  | 'auto'
  | 'analogous'
  | 'complementary'
  | 'triadic'
  | 'tetradic'
  | 'split-complementary'
  | 'monochromatic';

const HARMONIES: Exclude<Harmony, 'auto'>[] = [
  'analogous',
  'complementary',
  'triadic',
  'tetradic',
  'split-complementary',
  'monochromatic',
];

/** The hue offsets (relative to a base hue) that define each harmony. */
function hueOffsets(harmony: Exclude<Harmony, 'auto' | 'monochromatic'>): number[] {
  switch (harmony) {
    case 'analogous':
      return [-40, -20, 0, 20, 40, 60];
    case 'complementary':
      return [0, 180, 30, 210, 150, 330];
    case 'split-complementary':
      return [0, 150, 210, 30, 330, 180];
    case 'triadic':
      return [0, 120, 240, 60, 180, 300];
    case 'tetradic':
      return [0, 90, 180, 270, 45, 225];
  }
}

/**
 * A deterministic pseudo-random generator seeded by an integer, so palette
 * generation is reproducible for tests and never touches `Math.random` (which
 * some sandboxes forbid). Callers pass a fresh seed to get a fresh palette.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface GenerateOptions {
  /** How many swatches to produce (clamped 1–12). */
  count: number;
  /** Which harmony to use; `auto` picks one from the seed. */
  harmony?: Harmony;
  /** Anchor hue 0–360; omitted → derived from the seed. */
  baseHue?: number;
  /** Seed for reproducibility; omitted → derived from `count`+time-free entropy
   *  the caller supplies. Pass a changing value to reroll. */
  seed?: number;
}

/**
 * Generate a pleasing palette of `count` hex colours from colour theory.
 *
 * The harmony fixes the hues; saturation and lightness are spread across a
 * comfortable band and jittered slightly so the ramp reads as designed rather
 * than mechanical. Works for any count: harmony offsets are cycled, and extra
 * swatches walk the lightness ramp so a 6-colour complementary palette still
 * feels coherent.
 */
export function generatePalette(opts: GenerateOptions): string[] {
  const count = clamp(round(opts.count), 1, 12);
  const seed = opts.seed ?? 0x9e3779b9;
  const rng = mulberry32(seed);

  const harmony: Exclude<Harmony, 'auto'> =
    !opts.harmony || opts.harmony === 'auto'
      ? HARMONIES[Math.floor(rng() * HARMONIES.length)]
      : opts.harmony;

  const baseHue = opts.baseHue ?? Math.floor(rng() * 360);
  const baseSat = 55 + rng() * 30; // 55–85%: vivid but not neon

  const colors: string[] = [];

  if (harmony === 'monochromatic') {
    // One hue, a lightness ramp from dark to light.
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      const l = 22 + t * 62; // 22 → 84
      const s = baseSat - t * 12 + (rng() - 0.5) * 6;
      colors.push(hslToHex({ h: baseHue + (rng() - 0.5) * 8, s: clamp(s, 20, 95), l }));
    }
    return colors;
  }

  const offsets = hueOffsets(harmony);
  for (let i = 0; i < count; i++) {
    const h = baseHue + offsets[i % offsets.length] + (rng() - 0.5) * 10;
    // Walk lightness so repeated hues (count > offsets) don't collide.
    const band = Math.floor(i / offsets.length);
    const t = count === 1 ? 0.5 : i / (count - 1);
    const l = clamp(38 + t * 34 - band * 6 + (rng() - 0.5) * 8, 24, 82);
    const s = clamp(baseSat + (rng() - 0.5) * 14, 30, 92);
    colors.push(hslToHex({ h, s, l }));
  }
  return colors;
}

/** A single fresh colour that sits agreeably next to `near` (or a random one). */
export function randomColor(seed: number, near?: string): string {
  const rng = mulberry32(seed);
  const baseHue = near ? hexToHsl(near).h + 20 + rng() * 60 : rng() * 360;
  return hslToHex({ h: baseHue, s: 45 + rng() * 40, l: 40 + rng() * 30 });
}
