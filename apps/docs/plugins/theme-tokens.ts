import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

/**
 * One design token from the library's `theme.css` — its light (`:root`) and
 * dark (`.dark`) values, straight off the shipped stylesheet. Extracted at
 * build time so the /theming reference table can never drift from the CSS.
 */
export interface ThemeToken {
  /** Custom-property name, including the `--`. */
  name: string;
  /** Value declared on `:root`. */
  light?: string;
  /** Value declared on `.dark`. */
  dark?: string;
}

export interface ThemeTokensOptions {
  /** The stylesheet to read (the library's `theme.css`). */
  src: string;
  /** File to write (usually `public/theme-tokens.json`). */
  out: string;
}

/** All `--token: value;` declarations inside the first `selector { … }` block. */
function blockVars(css: string, selector: string): Map<string, string> {
  const vars = new Map<string, string>();
  const block = new RegExp(`${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
  for (const m of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) vars.set(m[1], m[2].trim());
  return vars;
}

/** Parse `theme.css` into tokens, in `:root` declaration order (dark-only last). */
export function extractTokens(css: string): ThemeToken[] {
  const light = blockVars(css, ':root');
  const dark = blockVars(css, '.dark');
  const tokens: ThemeToken[] = [...light].map(([name, value]) => ({ name, light: value, dark: dark.get(name) }));
  for (const [name, value] of dark) if (!light.has(name)) tokens.push({ name, dark: value });
  return tokens;
}

/**
 * Sibling of the search-index plugin: reads the library's `theme.css` at build
 * time and emits `theme-tokens.json` for the /theming reference table —
 * regenerated on change in dev, so the table is never a hand-copied list.
 */
export function themeTokensPlugin(opts: ThemeTokensOptions): Plugin {
  const write = () => {
    const tokens = extractTokens(readFileSync(resolve(opts.src), 'utf8'));
    mkdirSync(resolve(opts.out, '..'), { recursive: true });
    writeFileSync(resolve(opts.out), JSON.stringify(tokens), 'utf8');
    return tokens.length;
  };

  return {
    name: 'gabvdl-theme-tokens',
    buildStart() {
      const n = write();
      this.info(`theme-tokens: ${n} tokens`);
    },
    configureServer(server) {
      server.watcher.add(resolve(opts.src));
      server.watcher.on('change', (file) => {
        if (file === resolve(opts.src)) write();
      });
    },
  };
}
