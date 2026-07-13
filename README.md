# gabvdl design system

> ⚠️ **Very early alpha.** Expect breaking changes — the API moves fast and any
> `0.0.x` bump may break you. Pin an exact version. `1.0.0`, coming shortly,
> will be the first stable cut.

Gabriel Vidal's personal design system — the React components reused across the
homelab, catalogued in one place. Live at **[ui.gabvdl.xyz](https://ui.gabvdl.xyz)**,
published as [`@gabvdl/ui` on npm](https://www.npmjs.com/package/@gabvdl/ui),
mirrored at [github.com/GabrielVidal1/design-system](https://github.com/GabrielVidal1/design-system).

A small monorepo:

```
design-system/
├── packages/
│   └── ui/        @gabvdl/ui — the tree-shakeable component library
└── apps/
    └── docs/      @gabvdl/docs — landing + docs + live demo (ui.gabvdl.xyz)
```

## `@gabvdl/ui`

Tree-shakeable (ESM, `sideEffects` false except CSS), typed (bundled `.d.ts`),
built on shadcn primitives. Ships today:

- **`ImageViewerProvider` / `useImageViewer`** — a full-screen image viewer with
  wheel/pinch/double-tap zoom, drag-to-pan, a swipe/arrow carousel and
  drag-to-dismiss. Portalled to `<body>`, scroll-locked, keyboard-driven.
  Imported from the [Sherlock project](../sherlock-project).
- **`ViewableImage`** — a clickable image that opens the viewer over its group.
- **`ProgressiveImage`** — blurred thumbnail → full-res on scroll, cross-faded.
- **`Button`** — four variants, three size tiers (`sm`/`md`/`lg`, each with an
  icon-only twin), an icon slot, a `loading` state and an optional `tooltip`
  that doubles as the accessible name of an icon-only button.
- **`Input`** — the shadcn-style basic, styled from shared tokens.
- **`cn`** — the `clsx` + `tailwind-merge` class helper.

- **`IframePreview`** — a trigger (button, card, thumbnail…) that opens any page
  full-screen in an iframe: editable address bar, a reload that really re-fetches
  (`cacheBust`), phone/desktop tiers, a slot for your own controls. Built for
  phones (`100dvh`, safe areas). `IframePreviewOverlay` is the controlled half.

…plus `FuzzyList`, `VirtualList`, `Nav2D`, `RichInput`, `PhonePreview`,
`FloatingPanel`, `ResizableLayout`, `Changelog` and the `Progressive*` family.
The full catalogue, with a live demo per component, is the docs site.

### The shared primitives (v0.8)

Every homelab project had rewritten the same handful of things — three toast
systems, four theme toggles, a copy-to-clipboard snippet in five places, an
empty state in nine. Those are now one implementation each:

| | |
| --- | --- |
| **`ToastProvider` / `useToast`** | one callable `toast()` — types, an action link, and a `loading` toast you settle in place with `toast.update(id, …)` |
| **`Modal` / `useModal` / `useConfirm`** | portal, Escape, scrim-click, ref-counted scroll lock, focus trap, bottom sheet on phones — and `await confirm({ destructive: true })` in place of `window.confirm` |
| **`ThemeToggle` / `useTheme`** | light ⇄ dark ⇄ system, persisted, `<meta name=theme-color>` kept in step. No provider needed |
| **`Spinner` / `Skeleton` / `EmptyState`** | the three loading/empty shapes |
| **`StatusBadge` / `Badge`** | a `status → {label, tone, icon}` map, so a job reads the same colour in every service |
| **`SearchInput` / `DropZone` / `CopyButton` / `RelativeTime`** | ⌘K-focusable search, drag-and-drop (with folder walking), clipboard with an `execCommand` fallback for insecure origins, a `<time>` that keeps ticking |
| **`ElementPicker` / `ElementPickerField`** | point at a page and take it apart — hover draws the devtools box model, click selects; press-and-hold + drag does the same on a touchscreen. Hands back the live node plus a serializable parse: text, kind, hierarchy, computed styles, full HTML |
| **hooks** | `useMediaQuery` · `useIsMobile` · `useIsTouch` · `useLocalStorage` · `useLongPress` · `useCopyToClipboard` · `useIntersection` / `useInfiniteScroll` · `useScrollLock` · `useEscape` · `useOutsideClick` |
| **format** | `relTime` · `fmtDuration` · `fmtBytes` · `fmtNum` · `fmtCost` · `downloadFile` |

### Use

```bash
npm install @gabvdl/ui
```

```css
/* your Tailwind v4 entry */
@import "tailwindcss";
@import "@gabvdl/ui/styles.css";
```

```tsx
import { ImageViewerProvider, ViewableImage } from '@gabvdl/ui'

export function Gallery({ urls }: { urls: string[] }) {
  return (
    <ImageViewerProvider>
      {urls.map((url, i) => (
        <ViewableImage key={url} images={urls} index={i} full={url} alt={`Plate ${i + 1}`} />
      ))}
    </ImageViewerProvider>
  )
}
```

Every colour reads from CSS custom properties — override the tokens on `:root`
(or a `.dark` ancestor) to retheme without touching component code. The docs
site is the shipped library recoloured to a cyanotype.

Style entry points: `@gabvdl/ui/styles.css` (everything), `@gabvdl/ui/theme.css`
(design tokens only), `@gabvdl/ui/image-viewer.css` (overlay only),
`@gabvdl/ui/overlay.css` (modal + toast motion only).

## Develop

```bash
npm install
npm run build        # turbo: builds @gabvdl/ui, then the docs app
npm run dev          # docs dev server (build the library once first)
npm run deploy       # build, then push apps/docs to ui.gabvdl.xyz via zipgo
```

## Release

Two registries, two purposes:

- **Public npm** (`@gabvdl/ui`) — released by CI when a `v*` tag is pushed to
  the GitHub mirror. See [`RELEASING.md`](RELEASING.md).
- **Private verdaccio** (homelab dev builds) — published on demand with
  `./services/registry/publish.sh` from the homelab repo root, so lab projects
  can consume work-in-progress versions without a public release.
