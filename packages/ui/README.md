# @gabvdl/ui

Gabriel Vidal's personal design system — tree-shakeable React components built on
shadcn primitives, reused across the homelab. Flagship: a full-screen image
viewer with zoom, pan and swipe.

Published to the homelab's private npm registry (verdaccio). Browse it at
**[registry.lab.gabvdl.xyz](https://registry.lab.gabvdl.xyz)**; the docs + live
demo are at **[ui.gabvdl.xyz](https://ui.gabvdl.xyz)**.

## Install

```bash
# Point the @gabvdl scope at the private registry (once, per project .npmrc):
echo '@gabvdl:registry=http://localhost:4873/' >> .npmrc

npm install @gabvdl/ui
```

## Use

```tsx
import { ImageViewerProvider, ViewableImage } from '@gabvdl/ui'
import '@gabvdl/ui/styles.css'

export function Gallery({ urls }: { urls: string[] }) {
  return (
    <ImageViewerProvider>
      {urls.map((u) => (
        <ViewableImage key={u} src={u} />
      ))}
    </ImageViewerProvider>
  )
}
```

Peer deps: `react >=18`, `react-dom >=18`. Ships ESM + type declarations, and
side-effect-free except the CSS entry points (`styles.css`, `theme.css`,
`image-viewer.css`, `virtual-list.css`).

## Search: `FuzzyList` and `GlobalSearch`

`FuzzyList` is a Fuse.js search box over a windowed `VirtualList`. Two things
shape how it searches:

- **Quoting pins an exact match.** A bare query fuzzy-matches; any
  `"double-quoted"` segment must appear as a literal, case-insensitive substring.
  They mix — `parser "utils.ts"` fuzzy-matches `parser` and then keeps only rows
  whose fields contain `utils.ts`. Both kinds of hit are `<mark>`-highlighted.
- **The search is debounced** by `debounce` ms (default `400`). The input stays
  instant; only the Fuse pass and the list re-render trail behind it, and a small
  spinner shows while they do. `debounce={0}` searches on every keystroke.

`GlobalSearch` is the Cmd-K palette built from those pieces — a `Modal` holding a
`FuzzyList`. `items` may be an array *or a loader*, called the first time the
palette opens, which is how you lazily pull a build-time search index:

```tsx
<GlobalSearch
  searchKey="Ctrl+K"                    // "Mod+K" = ⌘ on Apple, Ctrl elsewhere · null = off
  items={() => fetch('/search-index.json').then((r) => r.json())}
  keys={[{ name: 'name', weight: 3 }, 'summary', 'props']}
  titleKey="name"
  descriptionKey="summary"
  badgeKey="kind"
  trigger="bar"                          // or "icon" (default) / "none" + controlled `open`
  onSelect={(entry) => navigate(entry.route)}
/>
```

### Generating that index at build time

The docs app ([`apps/docs/plugins/search-index.ts`](../../apps/docs/plugins/search-index.ts))
is the reference implementation: a Vite plugin that walks `packages/ui/src` with
the **TypeScript compiler API**, and for every symbol re-exported from
`src/index.ts` emits an entry — components, hooks, utilities, **and one entry per
prop** (`FuzzyList.debounce`, with its type and TSDoc). It writes
`public/search-index.json` on `buildStart` and regenerates on source changes in
dev, so nothing is hand-maintained: add a component and it is searchable on the
next build.

## Publishing (maintainer)

```bash
# from the homelab repo root, with the registry profile up:
./services/registry/publish.sh
```

Bump `version` in this package's `package.json` first — verdaccio rejects
re-publishing an existing version.
