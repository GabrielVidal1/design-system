#!/usr/bin/env node
/**
 * Generates docs/component-list.md — the at-a-glance index of @gabvdl/ui.
 *
 * The list is meant to be skimmed by an agent (or a human) who wants to know
 * "does the design system already have something for this?" without opening
 * the docs site or reading 4.5k lines of App.tsx.
 *
 * Source of truth:
 *   - apps/docs/src/App.tsx  → REGISTRY (name, sig, tag) + GROUP_OF + GROUP_BLURB.
 *     Parsed, not imported: App.tsx is a TSX module full of JSX demos, so
 *     importing it would mean standing up a bundler just to read four fields.
 *   - packages/ui/src/index.ts → the exported symbols per component.
 *   - packages/ui/src/hooks/index.ts → the hook names.
 *   - DESCRIPTIONS below → the one-line "what it's for", authored by hand.
 *
 * A component that lands in the REGISTRY without a DESCRIPTION entry is still
 * listed (from its sig), but the script warns — that is the nudge to write one.
 *
 * Usage: npm run docs:list    (or: node scripts/gen-component-list.mjs --check)
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APP_TSX = resolve(ROOT, 'apps/docs/src/App.tsx');
const UI_INDEX = resolve(ROOT, 'packages/ui/src/index.ts');
const HOOKS_INDEX = resolve(ROOT, 'packages/ui/src/hooks/index.ts');
const PKG_JSON = resolve(ROOT, 'packages/ui/package.json');
const OUT = resolve(ROOT, 'docs/component-list.md');

/* ─── Hand-authored descriptions ──────────────────────────────────────────────
 * One line each: what it does and when you'd reach for it. Keep them concrete —
 * this is the text an agent scans to decide whether to use the component. */
const DESCRIPTIONS = {
  'image-viewer':
    'Full-screen media overlay opened imperatively from anywhere — zoom, pan, swipe between items, images *and* video, plus an auto-advancing story mode.',
  'viewable-image':
    'A thumbnail that opens the ImageViewer at its index when clicked. The drop-in way to make a grid of images viewable.',
  'progressive-image':
    'Lazy blur-up image: renders `thumb`, swaps to `full` when it scrolls into view. Use for any long image grid.',
  'fuzzy-list':
    'Searchable list with a quote-aware fuzzy query (`"exact"` vs fuzzy), match highlighting, debounced ranking and optional lazy paging.',
  'global-search':
    'Cmd-K command palette over any item array — keyboard-driven, grouped results, custom hotkey.',
  'virtual-list':
    'Windowed list for tens of thousands of rows: multi-column grids, sticky group headers, `onEndReached` for infinite scroll.',
  'animated-list':
    'Non-virtualized list that FLIP-animates rows as they reorder. For short, live-sorted lists where movement should be legible.',
  collection:
    'Batteries-included browser for a set of records — grid/list/table views, built-in search, image cards. The fastest "show me these things" component.',
  'progressive-table':
    'Table whose cells reveal progressively, sharing the progressive timeline. For streamed/generated tabular output.',
  'data-table':
    'Sortable, selectable data table that collapses to cards on mobile. Column-driven; for real tabular data with interaction.',
  'stat-tile': 'KPI tile and row — label, big value, optional delta. For dashboard headline numbers.',
  progress: 'Determinate progress bar with tone and size variants.',
  'status-badge':
    'Coloured badge with a built-in job-status → tone map (`JOB_STATUS`). For queue/build/deploy states.',
  'relative-time':
    'A `<time>` element that re-renders on an interval to keep "3 min ago" honest.',
  'nav-2d':
    'Joystick navigation over a 2-D field of targets: hold and drag to ray-cast a selection, release to commit. Built for TV/gamepad-ish and one-handed touch.',
  tabs: 'Tabbed panels with controlled/uncontrolled value, variants, keyboard activation and swipe between tabs on touch.',
  button: 'The base button — variants, sizes, icon slot, loading state, built-in tooltip. Ships `Tooltip` too.',
  input: 'The base text input, styled to the theme tokens.',
  'rich-input':
    'The full composer: draft persistence, un-send window, file attachments, guideline tags, `#mention` autocomplete and prompt history. Use for any chat/agent input.',
  'search-input': 'Search field with a clear affordance and an optional keyboard shortcut hint.',
  'tag-filter': 'Row of filter chips (single or multiple select) with an "all" option.',
  'drop-zone':
    'File drop target plus the headless `useFileDrop` hook — accept filters, max size, folder drops, rejection reporting.',
  select: 'Select that becomes a searchable list on desktop and a bottom sheet on phones; supports per-option icons.',
  switch: 'Toggle switch, with a labelled-row layout for settings screens.',
  slider: 'Pointer-captured range slider with full arrow/Page/Home/End keyboard support.',
  'copy-button':
    'Copy-to-clipboard button with success feedback and native share fallback. Pairs with the `useCopyToClipboard` hook.',
  'element-picker':
    'Point at any DOM element on the page (hover / click / press-and-hold) and get its full HTML plus a parsed description — selector, hierarchy, computed style groups. Powers "pick an element" editor flows.',
  'palette-picker':
    'Vertical-stripe colour-palette editor (dropdown on desktop, bottom sheet on mobile) with dependency-free harmony generation, plus `ColorThemeProvider`/`paletteToVars` to push a palette into CSS variables.',
  'icon-picker':
    'Searchable horizontal virtual grid of icons. You pass the icon set (e.g. lucide) — the component ships none.',
  'file-editor':
    'Code/markdown editor with menu bar, gutter, syntax highlighting and a preview mode; the ref is the underlying textarea. Ships `CodeArea` and `Markdown` separately.',
  'char-roll': 'Tally-counter digit roll for a changing value.',
  'progressive-text': 'Typewriter text with speed, delay and delete-speed — the base of the progressive family.',
  'progressive-list': 'Staggered reveal of list items on the shared progressive timeline.',
  'progressive-bash':
    'Replays a terminal session: real timestamp gaps, command tokenizing, output classification, sticky prompt and an eased catch-up when it falls behind.',
  'progressive-timeline':
    'The clock the progressive components share — `useProgressiveSlot`/`ProgressiveTimelineSlot` let you sequence your own reveals in the same timeline.',
  changelog:
    'Renders a parsed `CHANGELOG.md` — trigger button, full page, `useChangelog` fetching/parsing, and a toast when a new version ships.',
  toast: 'Toast system — `ToastProvider` + `useToast`, with types, actions and in-place updates.',
  spinner: 'Loading spinner with size, label and centering.',
  skeleton: 'Loading placeholders — `Skeleton`, `SkeletonText`, `SkeletonGrid`.',
  'empty-state': 'The empty/zero-data panel: icon, title, description, call-to-action.',
  modal:
    'Modal dialog plus the imperative layer — `useModal` to open one from code and `useConfirm` for yes/no. Use instead of re-implementing a dialog.',
  'phone-preview': 'iPhone-style device frame around children or a `src` URL, with dynamic island and status bar.',
  'iframe-preview': 'Preview an arbitrary URL in an iframe with a URL field, action buttons and a full-screen mode.',
  'floating-panel':
    'Draggable, resizable floating panels with a dock — tabbing, close/reopen, placement memory. For tool windows and inspectors.',
  'resizable-layout':
    'App scaffold with resizable left/right/top/bottom panels on desktop that become panels or drawers on mobile.',
  theme: 'Dark/light theming — `ThemeProvider`, `ThemeToggle`, `useTheme`, `setTheme`, `toggleTheme`.',
  format:
    'Shared formatters used across the lab: `relTime`, `fmtDuration`, `fmtBytes`, `fmtNum`, `fmtCost`, `fmtDateTime`, `downloadFile`.',
  cn: 'The `clsx` + `tailwind-merge` class-name helper every component uses.',
  hooks: 'The headless half of the library — see the Hooks table below.',
};

/** Hooks get their own table; descriptions keyed by export name. */
const HOOK_DESCRIPTIONS = {
  useCopyToClipboard: 'Copy text with success state and a native-share fallback.',
  useDebouncedValue: 'Debounced mirror of a fast-changing value.',
  useIntersection: 'IntersectionObserver as a ref + boolean.',
  useInfiniteScroll: 'Fire a callback when a sentinel scrolls into view.',
  useLocalStorage: 'State persisted to localStorage, synced across tabs.',
  useLongPress: 'Long-press gesture with movement tolerance and the press point.',
  useMediaQuery: 'Subscribe to any media query.',
  useIsMobile: 'True on phone-sized viewports — the mobile/desktop branch used across the library.',
  useIsTouch: 'True when the primary input is touch.',
  usePrefersDark: 'The OS dark-mode preference.',
  usePrefersReducedMotion: 'The OS reduced-motion preference — gate animations on it.',
  useEscape: 'Run a handler on Escape, respecting overlay stacking.',
  useOutsideClick: 'Run a handler on a click outside a ref.',
  useScrollLock: 'Lock body scroll while an overlay is open.',
};

/* ─── Parse the docs registry ─────────────────────────────────────────────── */

const app = readFileSync(APP_TSX, 'utf8');

/** REGISTRY entries: id / name / sig / tag, in declaration order. */
function parseRegistry() {
  const re =
    /\{\s*\n\s*id: (["'])(.*?)\1,\s*\n\s*name: (["'])(.*?)\3,\s*\n\s*sig: ([`"'])([\s\S]*?)\5,\s*\n\s*tag: (["'])(.*?)\7,/g;
  const out = [];
  let m;
  while ((m = re.exec(app))) out.push({ id: m[2], name: m[4], sig: m[6], tag: m[8] });
  return out;
}

/** A `Record<string, string>` object literal → JS object. */
function parseRecord(varName) {
  const start = app.indexOf(`const ${varName}`);
  if (start === -1) throw new Error(`${varName} not found in App.tsx`);
  const open = app.indexOf('{', start);
  let depth = 0;
  let end = open;
  for (; end < app.length; end++) {
    if (app[end] === '{') depth++;
    else if (app[end] === '}' && --depth === 0) break;
  }
  const body = app.slice(open + 1, end);
  const out = {};
  const re = /(?:(["'])(.*?)\1|([A-Za-z_$][\w$]*))\s*:\s*\n?\s*(["'])([\s\S]*?)\4,/g;
  let m;
  while ((m = re.exec(body))) out[m[2] ?? m[3]] = m[5].replace(/\s*\n\s*/g, ' ');
  return out;
}

/** The GROUPS tuple, in display order. */
function parseGroups() {
  const m = app.match(/const GROUPS = \[([\s\S]*?)\] as const;/);
  if (!m) throw new Error('GROUPS not found in App.tsx');
  return [...m[1].matchAll(/(["'])(.*?)\1/g)].map((g) => g[2]);
}

/** Exported symbols per component module, from index.ts (values, not types). */
function parseExports() {
  const src = readFileSync(UI_INDEX, 'utf8');
  const byModule = {};
  // `[^{}]*?` (not `[\s\S]*?`) so a multi-line block can't run past its own
  // closing brace into the next export statement.
  const re = /export\s+(type\s+)?\{([^{}]*?)\}\s*from\s*'\.\/(?:components|lib)\/([\w-]+)'/g;
  let m;
  while ((m = re.exec(src))) {
    if (m[1]) continue; // skip `export type { … }`
    const names = m[2]
      .split(',')
      .map((s) => s.trim().split(/\s+as\s+/).pop().trim())
      .filter(Boolean);
    (byModule[m[3]] ??= []).push(...names);
  }
  // `cn` comes from lib/utils; the registry calls that entry `cn`.
  if (byModule.utils) byModule.cn = byModule.utils;
  return byModule;
}

/** The catch-all `hooks` registry entry lists the hook names themselves. */
function attachHookExports(byModule, hookNames) {
  byModule.hooks = hookNames;
  return byModule;
}

function parseHooks() {
  const src = readFileSync(HOOKS_INDEX, 'utf8');
  const names = [];
  const re = /export\s+\{([\s\S]*?)\}\s*from/g;
  let m;
  while ((m = re.exec(src))) {
    names.push(...m[1].split(',').map((s) => s.trim()).filter(Boolean));
  }
  return names;
}

/* ─── Render ──────────────────────────────────────────────────────────────── */

const registry = parseRegistry();
const groupOf = parseRecord('GROUP_OF');
const blurbs = parseRecord('GROUP_BLURB');
const groups = parseGroups();
const hooks = parseHooks();
const exportsByModule = attachHookExports(parseExports(), hooks);
const version = JSON.parse(readFileSync(PKG_JSON, 'utf8')).version;

const missing = registry.filter((e) => !DESCRIPTIONS[e.id]).map((e) => e.id);

// An entry with no GROUP_OF mapping renders in no section — it would silently
// disappear from this list (and from the docs catalogue, which groups the same
// way). Fail loudly instead: the fix belongs in App.tsx's GROUP_OF.
const ungrouped = registry.filter((e) => !groupOf[e.id]).map((e) => e.id);
if (ungrouped.length) {
  console.error(`✖ not in GROUP_OF (App.tsx), so they render nowhere: ${ungrouped.join(', ')}`);
  process.exit(1);
}

/** `ImageViewerProvider · useImageViewer` → `` `ImageViewerProvider` · `useImageViewer` `` */
function exportsCell(entry) {
  // The catch-all hooks entry has its own table below — don't inline 14 names.
  if (entry.id === 'hooks') return `${hooks.length} hooks (see below)`;
  const names = exportsByModule[entry.id];
  if (!names?.length) return `\`${entry.name}\``;
  return names.map((n) => `\`${n}\``).join(' · ');
}

function escapeCell(s) {
  return s.replace(/\|/g, '\\|');
}

const lines = [];
lines.push('# `@gabvdl/ui` — component list');
lines.push('');
lines.push(
  `Every component and hook in the library (v${version}), with a one-line description ` +
    'of what it is for. Skim this before building UI: if something here already covers ' +
    'the need, use it instead of writing a new component.',
);
lines.push('');
lines.push(
  '> Generated by `scripts/gen-component-list.mjs` (`npm run docs:list`) from the docs ' +
    'registry in `apps/docs/src/App.tsx` and the exports in `packages/ui/src/index.ts`. ' +
    '**Do not edit by hand** — add the description to the generator instead.',
);
lines.push('');
lines.push('Live demos for every entry: [ui.gabvdl.xyz](https://ui.gabvdl.xyz) — ');
lines.push('the per-component page is `ui.gabvdl.xyz/#/c/<id>`.');
lines.push('');
lines.push('```tsx');
lines.push("import { Button, Modal, useToast } from '@gabvdl/ui';");
lines.push("import '@gabvdl/ui/styles.css'; // or theme.css for tokens only");
lines.push('```');
lines.push('');

for (const group of groups) {
  const items = registry.filter((e) => groupOf[e.id] === group);
  if (!items.length) continue;
  lines.push(`## ${group}`);
  lines.push('');
  if (blurbs[group]) {
    lines.push(`*${blurbs[group]}*`);
    lines.push('');
  }
  lines.push('| Component | Exports | What it is for |');
  lines.push('| --- | --- | --- |');
  for (const e of items) {
    const desc = DESCRIPTIONS[e.id] ?? `_(no description yet)_ — ${e.sig}`;
    lines.push(
      `| **[${e.name}](https://ui.gabvdl.xyz/#/c/${e.id})** | ${escapeCell(
        exportsCell(e),
      )} | ${escapeCell(desc)} |`,
    );
  }
  lines.push('');
}

/* The Hooks group's single registry entry points here. */
lines.push('## Hooks (detail)');
lines.push('');
lines.push('| Hook | What it is for |');
lines.push('| --- | --- |');
for (const h of hooks) {
  lines.push(`| \`${h}\` | ${escapeCell(HOOK_DESCRIPTIONS[h] ?? '_(no description yet)_')} |`);
}
lines.push('');
lines.push('---');
lines.push('');
lines.push(
  `${registry.length} catalogue entries · ${hooks.length} hooks · ` +
    'conventions and contribution rules in [CLAUDE.md](../CLAUDE.md), direction in [GOAL.md](../GOAL.md).',
);
lines.push('');

const md = lines.join('\n');

if (process.argv.includes('--check')) {
  const current = (() => {
    try {
      return readFileSync(OUT, 'utf8');
    } catch {
      return null;
    }
  })();
  if (current !== md) {
    console.error('docs/component-list.md is out of date — run `npm run docs:list`.');
    process.exit(1);
  }
  console.log('docs/component-list.md is up to date.');
} else {
  writeFileSync(OUT, md);
  console.log(`docs/component-list.md — ${registry.length} entries, ${hooks.length} hooks.`);
}

if (missing.length) {
  console.warn(`\n⚠ no description for: ${missing.join(', ')}`);
  console.warn('  add them to DESCRIPTIONS in scripts/gen-component-list.mjs');
}
