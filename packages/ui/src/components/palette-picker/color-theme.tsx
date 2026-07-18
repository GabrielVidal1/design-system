import * as React from 'react';

import { cn } from '../../lib/utils';
import { hexToHsl, hslToHex, readableTextColor, type HSL } from '../../lib/color';

/**
 * A palette is just an ordered list of hex colours. Index 0 is the primary
 * accent, the rest are supporting colours. `ColorThemeProvider` maps them onto
 * CSS custom properties on a scoped wrapper so any subtree can retheme without
 * touching the global `:root`.
 */
export type Palette = string[];

export interface ColorTheme {
  /** Ordered hex colours; `[0]` is the accent. */
  palette: Palette;
  /** Optional CSS `font-family` stack applied to the scope. */
  font?: string;
}

export interface ColorThemeContextValue extends ColorTheme {
  /** The CSS custom properties this theme resolves to, ready to spread onto
   *  `style`. Exposed so a consumer can apply the same vars elsewhere. */
  vars: React.CSSProperties;
}

const ColorThemeContext = React.createContext<ColorThemeContextValue | null>(null);

/** Read the nearest color theme; returns `null` outside a provider. */
export function useColorTheme(): ColorThemeContextValue | null {
  return React.useContext(ColorThemeContext);
}

/**
 * Turn a palette into CSS custom properties.
 *
 * `--palette-0…N` expose each raw swatch. The accent (swatch 0) is also mapped
 * onto the shared design-token names (`--primary`, `--ring`, `--accent`) with a
 * readable foreground picked automatically, so existing `bg-primary` /
 * `text-primary` utilities recolour for free. A soft tinted `--accent`/
 * `--muted` are derived from the accent's hue so surfaces feel of-a-piece.
 */
export function paletteToVars(theme: ColorTheme): React.CSSProperties {
  const vars: Record<string, string> = {};
  const palette = theme.palette.length ? theme.palette : ['#1c1917'];

  palette.forEach((hex, i) => {
    vars[`--palette-${i}`] = hex;
  });
  vars['--palette-count'] = String(palette.length);

  const accent = palette[0];
  const accentHsl = hexToHsl(accent);
  const tint = (h: HSL) => hslToHex(h);

  vars['--primary'] = accent;
  vars['--primary-foreground'] = readableTextColor(accent);
  vars['--ring'] = accent;
  vars['--accent'] = tint({ ...accentHsl, s: Math.min(accentHsl.s, 70), l: 94 });
  vars['--accent-foreground'] = tint({ ...accentHsl, s: Math.min(accentHsl.s, 60), l: 24 });
  vars['--muted'] = tint({ ...accentHsl, s: Math.min(accentHsl.s, 30), l: 96 });
  vars['--secondary'] = tint({ ...accentHsl, s: Math.min(accentHsl.s, 30), l: 96 });

  if (theme.font) vars['--palette-font'] = theme.font;

  return vars as React.CSSProperties;
}

export interface ColorThemeProviderProps extends ColorTheme {
  /** The element to render as the themed scope. Default `div`. */
  as?: React.ElementType;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  /** Also stamp the vars on `:root` (whole document) instead of a scoped
   *  wrapper — for a single-profile app that wants the palette everywhere. */
  global?: boolean;
}

/**
 * Provide a colour theme to a subtree.
 *
 * By default it renders a wrapper element carrying the palette's CSS variables,
 * so styling stays scoped and several themed sections can coexist on one page
 * (each sub-profile in a gallery, say). Pass `global` to write the same vars to
 * `document.documentElement` instead.
 */
export function ColorThemeProvider({
  palette,
  font,
  as,
  className,
  style,
  children,
  global = false,
}: ColorThemeProviderProps) {
  const theme = React.useMemo<ColorTheme>(() => ({ palette, font }), [palette, font]);
  const vars = React.useMemo(() => paletteToVars(theme), [theme]);

  React.useEffect(() => {
    if (!global || typeof document === 'undefined') return;
    const root = document.documentElement;
    const entries = Object.entries(vars as Record<string, string>);
    entries.forEach(([k, v]) => root.style.setProperty(k, v));
    return () => entries.forEach(([k]) => root.style.removeProperty(k));
  }, [global, vars]);

  const ctx = React.useMemo<ColorThemeContextValue>(
    () => ({ palette, font, vars }),
    [palette, font, vars],
  );

  if (global) {
    return <ColorThemeContext.Provider value={ctx}>{children}</ColorThemeContext.Provider>;
  }

  const Tag = as ?? 'div';
  return (
    <ColorThemeContext.Provider value={ctx}>
      <Tag
        className={cn(className)}
        style={{
          ...vars,
          ...(font ? { fontFamily: 'var(--palette-font)' } : null),
          ...style,
        }}
      >
        {children}
      </Tag>
    </ColorThemeContext.Provider>
  );
}
