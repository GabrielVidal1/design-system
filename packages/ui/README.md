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

## Publishing (maintainer)

```bash
# from the homelab repo root, with the registry profile up:
./services/registry/publish.sh
```

Bump `version` in this package's `package.json` first — verdaccio rejects
re-publishing an existing version.
