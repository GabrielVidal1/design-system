# gabvdl design system

Gabriel Vidal's personal design system — the React components reused across the
homelab, catalogued in one place. Live at **[ui.gabvdl.xyz](https://ui.gabvdl.xyz)**.

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
- **`Button` / `Input`** — the shadcn-style basics, styled from shared tokens.
- **`cn`** — the `clsx` + `tailwind-merge` class helper.

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
(design tokens only), `@gabvdl/ui/image-viewer.css` (overlay only).

## Develop

```bash
npm install
npm run build        # turbo: builds @gabvdl/ui, then the docs app
npm run dev          # docs dev server (build the library once first)
npm run deploy       # build, then push apps/docs to ui.gabvdl.xyz via zipgo
```
