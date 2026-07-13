import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import ts from 'typescript';
import type { Plugin } from 'vite';

/**
 * One searchable thing. Components, hooks and utilities each get an entry, and
 * so does every individual prop — searching "debounce" should land you on
 * `FuzzyList.debounce`, not just somewhere in the catalogue.
 */
export interface IndexEntry {
  /** Docs id — the component directory name, which is also the route segment. */
  id: string;
  /** `FuzzyList`, `useDebouncedValue`, `FuzzyList.debounce`… */
  name: string;
  kind: 'component' | 'hook' | 'util' | 'prop';
  /** First paragraph of the TSDoc, flattened to one line. */
  summary: string;
  /** Prop entries: the declared type, printed from source. */
  type?: string;
  /** Component entries: every prop name, space-joined — so a prop name finds its
   * component too, one rank below the prop's own entry. */
  props?: string;
  /** Component entries: the exported symbols that ship from the same module. */
  exports?: string;
  /** Repo-relative source path. */
  file: string;
  /** Where the docs site should navigate on select. */
  route: string;
}

export interface SearchIndexOptions {
  /** Library source root — the directory holding `components/`, `hooks/`, `lib/`. */
  src: string;
  /** File to write (usually `public/search-index.json`). */
  out: string;
  /** Prefixed to the id to build a route. Default `#/c/`. */
  routeBase?: string;
  /** Force a docs id for a source directory/file stem (`lib/utils.ts` → `cn`). */
  idOverrides?: Record<string, string>;
}

/* ─── TSDoc ────────────────────────────────────────────────────────────────── */

/** A TSDoc comment is a node array once it contains `{@link …}` — those link
 * nodes carry their target in `name`, not `text`, so read both. */
const partText = (c: ts.JSDocComment): string => {
  const link = c as ts.JSDocLink;
  const target = link.name ? link.name.getText() : '';
  return `${target}${c.text ?? ''}`;
};

const flatten = (comment: string | ts.NodeArray<ts.JSDocComment> | undefined): string => {
  if (!comment) return '';
  const text = typeof comment === 'string' ? comment : comment.map(partText).join('');
  return text
    .split(/\n\s*\n/)[0] // first paragraph only
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\{@link\s+([^}]+)\}/g, (_, l: string) => l.split('.').pop() ?? l)
    .replace(/\s+/g, ' ')
    .trim();
};

const docOf = (node: ts.Node): string => {
  const docs = ts.getJSDocCommentsAndTags(node).filter(ts.isJSDoc);
  return flatten(docs[0]?.comment);
};

const isExported = (node: ts.Node): boolean =>
  ts.canHaveModifiers(node) &&
  (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);

/* ─── Extraction ───────────────────────────────────────────────────────────── */

/** Every .ts/.tsx under `dir`, minus barrels — an `index.ts` re-export carries no docs. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((p) => /\.tsx?$/.test(p) && !p.endsWith('index.ts') && !p.endsWith('.d.ts'))
    .map((p: string) => join(dir, p));
}

/** Docs id for a source file: the `components/<id>/` directory, or an override. */
function idFor(src: string, file: string, overrides: Record<string, string>): string {
  const rel = relative(src, file).split(sep);
  const stem = rel[rel.length - 1].replace(/\.tsx?$/, '');
  const key = rel.join('/');
  if (overrides[key]) return overrides[key];
  if (rel[0] === 'components') return rel[1];
  if (rel[0] === 'hooks') return 'hooks';
  return stem;
}

/**
 * The package's public API — every name `src/index.ts` re-exports. Anything else
 * in the tree is an internal helper and has no business in a user-facing palette.
 */
function publicApi(src: string): Set<string> {
  const barrel = join(src, 'index.ts');
  const sf = ts.createSourceFile(barrel, readFileSync(barrel, 'utf8'), ts.ScriptTarget.Latest, true);
  const names = new Set<string>();
  for (const stmt of sf.statements) {
    if (!ts.isExportDeclaration(stmt) || !stmt.exportClause) continue;
    if (!ts.isNamedExports(stmt.exportClause)) continue;
    for (const spec of stmt.exportClause.elements) names.add(spec.name.text);
  }
  return names;
}

function extract(
  file: string,
  id: string,
  route: string,
  repoFile: string,
  api: Set<string>,
): IndexEntry[] {
  const text = readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  const symbols: { name: string; kind: IndexEntry['kind']; summary: string }[] = [];
  const propsByOwner = new Map<string, { name: string; type: string; summary: string; optional: boolean }[]>();

  for (const stmt of sf.statements) {
    if (!isExported(stmt)) continue;

    // `export function Foo()` / `export function useFoo()`
    if (ts.isFunctionDeclaration(stmt) && stmt.name) {
      const name = stmt.name.text;
      if (api.has(name)) symbols.push({ name, kind: kindOf(name), summary: docOf(stmt) });
      continue;
    }

    // `export const Foo = …` (arrow components, memoised ones, plain consts)
    if (ts.isVariableStatement(stmt)) {
      for (const d of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(d.name)) continue;
        const name = d.name.text;
        if (!api.has(name)) continue;
        symbols.push({ name, kind: kindOf(name), summary: docOf(stmt) });
      }
      continue;
    }

    // `export interface FooProps { … }` — the props table for `Foo`.
    if (ts.isInterfaceDeclaration(stmt)) {
      const owner = stmt.name.text.replace(/Props$/, '');
      if (owner === stmt.name.text) continue; // not a props bag
      const props = stmt.members.filter(ts.isPropertySignature).map((m) => ({
        name: m.name.getText(sf),
        type: m.type ? m.type.getText(sf).replace(/\s+/g, ' ') : 'unknown',
        summary: docOf(m),
        optional: Boolean(m.questionToken),
      }));
      propsByOwner.set(owner, [...(propsByOwner.get(owner) ?? []), ...props]);
    }
  }

  if (symbols.length === 0) return [];

  const exported = symbols.map((s) => s.name).join(' ');
  const entries: IndexEntry[] = [];

  for (const sym of symbols) {
    const props = propsByOwner.get(sym.name) ?? [];
    entries.push({
      id,
      name: sym.name,
      kind: sym.kind,
      summary: sym.summary,
      props: props.map((p) => p.name).join(' ') || undefined,
      exports: exported,
      file: repoFile,
      route,
    });
    for (const p of props) {
      entries.push({
        id,
        name: `${sym.name}.${p.name}`,
        kind: 'prop',
        summary: p.summary,
        type: `${p.optional ? '?' : ''}: ${p.type}`,
        file: repoFile,
        route,
      });
    }
  }
  return entries;
}

const kindOf = (name: string): IndexEntry['kind'] =>
  /^use[A-Z]/.test(name) ? 'hook' : /^[A-Z]/.test(name) ? 'component' : 'util';

/** Build the whole index. Exported so a CI script can call it without Vite. */
export function buildIndex({ src, routeBase = '#/c/', idOverrides = {} }: SearchIndexOptions): IndexEntry[] {
  const root = resolve(src);
  const api = publicApi(root);
  const entries: IndexEntry[] = [];
  for (const file of sourceFiles(root)) {
    const id = idFor(root, file, idOverrides);
    entries.push(...extract(file, id, `${routeBase}${id}`, relative(resolve(root, '../..'), file), api));
  }
  // Components first, then hooks/utils, then the long tail of props — Fuse keeps
  // ties in input order, so this is the tiebreak for an empty query too.
  const rank = { component: 0, hook: 1, util: 2, prop: 3 } as const;
  return entries.sort((a, b) => rank[a.kind] - rank[b.kind] || a.name.localeCompare(b.name));
}

/**
 * Generate a static `search-index.json` from the library source at build time —
 * and regenerate it whenever a source file changes in dev, so the palette is
 * never stale. The docs app fetches the JSON lazily, the first time the palette
 * opens, so it costs nothing on first paint.
 */
export function searchIndexPlugin(opts: SearchIndexOptions): Plugin {
  const write = () => {
    const entries = buildIndex(opts);
    mkdirSync(resolve(opts.out, '..'), { recursive: true });
    writeFileSync(resolve(opts.out), JSON.stringify(entries), 'utf8');
    return entries.length;
  };

  return {
    name: 'gabvdl-search-index',
    buildStart() {
      const n = write();
      this.info(`search-index: ${n} entries`);
    },
    configureServer(server) {
      server.watcher.add(resolve(opts.src));
      const onChange = (file: string) => {
        if (file.startsWith(resolve(opts.src)) && /\.tsx?$/.test(file)) write();
      };
      server.watcher.on('change', onChange);
      server.watcher.on('add', onChange);
      server.watcher.on('unlink', onChange);
    },
  };
}
