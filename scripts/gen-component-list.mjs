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
 *   - The component sources → the description, read from the `@summary` JSDoc
 *     tag on the component's primary export. The docs live next to the code
 *     they describe, so they get updated in the same edit.
 *
 * Writing a summary:
 *
 *     /**
 *      * …whatever prose the component already had…
 *      *
 *      * @summary Row of filter chips (single or multiple select) with an
 *      * "all" option.
 *      *\/
 *     export function TagFilter(…)
 *
 * The tag runs to the end of the block (or to the next @tag), so it can wrap
 * over several lines. An entry whose primary export has no `@summary` is still
 * listed (falling back to its docs `sig`), but the script warns — that is the
 * nudge to write one.
 *
 * Usage: npm run docs:list    (or: node scripts/gen-component-list.mjs --check)
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APP_TSX = resolve(ROOT, 'apps/docs/src/App.tsx');
const UI_INDEX = resolve(ROOT, 'packages/ui/src/index.ts');
const HOOKS_INDEX = resolve(ROOT, 'packages/ui/src/hooks/index.ts');
const PKG_JSON = resolve(ROOT, 'packages/ui/package.json');
const OUT = resolve(ROOT, 'docs/component-list.md');

/* ─── Where each catalogue entry's summary lives ──────────────────────────────
 * registry id → the exported symbol whose `@summary` describes it. Most ids map
 * to their own directory; the handful that don't (the image-viewer trio, the
 * module-level `cn`/`format`/`hooks` entries) name their file explicitly.
 *
 * `dir`  — component directory under packages/ui/src/components (default: the id)
 * `sym`  — the export carrying the @summary (default: the registry `name`)
 * `file` — an explicit path under packages/ui/src, for non-component entries */
const SUMMARY_SOURCE = {
  'image-viewer': { sym: 'ImageViewerProvider' },
  'viewable-image': { dir: 'image-viewer', sym: 'ViewableImage' },
  'progressive-image': { dir: 'image-viewer', sym: 'ProgressiveImage' },
  'nav-2d': { sym: 'Nav2DProvider' },
  toast: { sym: 'ToastProvider' },
  'progressive-timeline': { sym: 'ProgressiveTimelineSlot' },
  theme: { sym: 'ThemeToggle' },
  cn: { file: 'lib/utils.ts', sym: 'cn' },
  format: { file: 'lib/format.ts' },
  hooks: { file: 'hooks/index.ts' },
};

/**
 * Read the `@summary` tag out of a JSDoc block.
 *
 * When `sym` is given we take the block immediately preceding that
 * declaration; otherwise the module's leading block. The tag body runs to the
 * end of the block or the next `@tag`, so summaries may wrap over lines.
 */
function readSummary(id, name) {
  const spec = SUMMARY_SOURCE[id] ?? {};
  const sym = spec.sym ?? name;
  const rel = spec.file ?? `components/${spec.dir ?? id}/${spec.dir ?? id}.tsx`;
  let src = readSource(rel);

  // Component dirs re-export from a sibling file (theme/theme-toggle.tsx,
  // file-editor/file-editor.tsx…). If the symbol isn't in the obvious file,
  // follow the directory's barrel to wherever it is actually declared.
  if (src === null || !declIndex(src, sym)) {
    const viaBarrel = resolveViaBarrel(spec.dir ?? id, sym);
    if (viaBarrel) src = viaBarrel;
  }
  if (src === null) return null;

  const block = spec.file && !spec.sym ? leadingBlock(src) : blockBefore(src, sym);
  if (!block) return null;

  const m = block.match(/@summary\s+([\s\S]*?)(?=\n\s*\*\s*@|\s*$)/);
  if (!m) return null;
  return m[1]
    .split('\n')
    .map((l) => l.replace(/^\s*\*\s?/, '').trim())
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Read a file under packages/ui/src, or null if it isn't there. */
function readSource(rel) {
  const p = resolve(ROOT, 'packages/ui/src', rel);
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
}

/** Index of `export (function|const|class) <sym>`, or 0 if absent. */
function declIndex(src, sym) {
  const m = src.match(
    new RegExp(`^export\\s+(?:default\\s+)?(?:function|const|class)\\s+${sym}\\b`, 'm'),
  );
  return m ? m.index : 0;
}

/** Follow a component dir's index.ts to the file declaring `sym`. */
function resolveViaBarrel(dir, sym) {
  const barrel = readSource(`components/${dir}/index.ts`);
  if (!barrel) return null;
  const re = /export\s+(?:type\s+)?\{([^{}]*?)\}\s*from\s*'\.\/([\w./-]+)'/g;
  let m;
  while ((m = re.exec(barrel))) {
    const names = m[1].split(',').map((s) => s.trim().split(/\s+as\s+/).pop().trim());
    if (!names.includes(sym)) continue;
    for (const ext of ['.tsx', '.ts', '/index.tsx', '/index.ts']) {
      const src = readSource(`components/${dir}/${m[2]}${ext}`);
      if (src !== null) return src;
    }
  }
  return null;
}

/**
 * The JSDoc block directly above `sym`'s declaration.
 *
 * Take the text before the declaration, require it to *end* with a comment
 * close, then walk back to the nearest `/**` — the last one, not the first.
 * A lazy `/\*\*[\s\S]*?\*\/$/` would anchor on the earliest `/**` in the file
 * and swallow every declaration in between (several hooks share one file).
 */
function blockBefore(src, sym) {
  const at = declIndex(src, sym);
  if (!at) return null;
  const before = src.slice(0, at);
  if (!/\*\/\s*$/.test(before)) return null;
  const close = before.lastIndexOf('*/');
  const open = before.lastIndexOf('/**', close);
  if (open === -1) return null;
  return before.slice(open + 3, close);
}

/** The module's own leading JSDoc block. */
function leadingBlock(src) {
  const m = src.match(/^\s*\/\*\*([\s\S]*?)\*\//);
  return m ? m[1] : null;
}

/** Hook name → `@summary`, read from wherever the hook is declared. */
function readHookSummaries(names) {
  const dir = resolve(ROOT, 'packages/ui/src/hooks');
  const files = readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.includes('.test.'));
  const out = {};
  for (const name of names) {
    for (const f of files) {
      const src = readFileSync(resolve(dir, f), 'utf8');
      const block = blockBefore(src, name);
      if (!block) continue;
      const m = block.match(/@summary\s+([\s\S]*?)(?=\n\s*\*\s*@|\s*$)/);
      if (!m) continue;
      out[name] = m[1]
        .split('\n')
        .map((l) => l.replace(/^\s*\*\s?/, '').trim())
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      break;
    }
  }
  return out;
}

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

/** id → the `@summary` read out of that component's source. */
const summaries = Object.fromEntries(
  registry.map((e) => [e.id, readSummary(e.id, e.name)]).filter(([, s]) => s),
);
const hookSummaries = readHookSummaries(hooks);

const missing = registry.filter((e) => !summaries[e.id]).map((e) => e.id);
const missingHooks = hooks.filter((h) => !hookSummaries[h]);

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
    const desc = summaries[e.id] ?? `_(no description yet)_ — ${e.sig}`;
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
  lines.push(`| \`${h}\` | ${escapeCell(hookSummaries[h] ?? '_(no description yet)_')} |`);
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

if (missing.length || missingHooks.length) {
  for (const id of missing) console.warn(`⚠ no @summary for: ${id}`);
  for (const h of missingHooks) console.warn(`⚠ no @summary for hook: ${h}`);
  console.warn("  add an `@summary` JSDoc tag on the export, then re-run.");
}
