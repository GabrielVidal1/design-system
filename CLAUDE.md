# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

Gabriel Vidal's personal design system — `@gabvdl/ui`, the React component
library reused across the homelab, plus its docs/demo site at
[ui.gabvdl.xyz](https://ui.gabvdl.xyz). **Where it's going is defined in
[GOAL.md](GOAL.md)** — read it before adding components: it holds the north
star (mobile-first, complete coverage, editor toolkit) and the per-category
gap list.

A turborepo npm-workspaces monorepo:

```
packages/ui/    @gabvdl/ui — the tree-shakeable component library
apps/docs/      @gabvdl/docs — landing + catalogue + live demos (ui.gabvdl.xyz)
```

## Commands

```bash
npm install
npm run build        # turbo: @gabvdl/ui then docs
npm run build:ui     # library only
npm run dev          # docs dev server (build the library once first)
npm run typecheck    # tsc -b across the workspace
npm run test         # vitest (packages/ui)
npm run deploy       # build + push apps/docs to ui.gabvdl.xyz via zipgo
```

## Library layout (`packages/ui`)

- One directory per component under `src/components/<kebab-name>/`; shared
  hooks in `src/hooks/`, utilities in `src/lib/`, CSS in `src/styles/`.
- Everything public is re-exported from `src/index.ts` (bundled `.d.ts`).
- Style entry points: `styles.css` (everything), `theme.css` (tokens only),
  `image-viewer.css`, `overlay.css`. New overlay-ish components add their
  motion CSS to the narrowest applicable entry.

### Component conventions

- **Mobile-first, desktop-compatible.** Touch is the primary input: gestures,
  `useLongPress`, safe areas, `100dvh`, bottom-sheet behaviour on phones
  (`useIsMobile`) — then hover/keyboard/pointer layered on top. One API, no
  mobile variant.
- **Tokens, not colours.** Every colour reads a CSS custom property from
  `theme.css`; consumers retheme on `:root` / `.dark` without touching
  component code.
- **Tree-shakeable.** ESM, `sideEffects` false except CSS; no cross-component
  imports that drag unrelated code along.
- Reuse the shared primitives (`cn`, `useEscape`, `useScrollLock`,
  `useOutsideClick`, `Modal`, toast…) instead of re-implementing them.

## Docs app (`apps/docs`)

`src/App.tsx` owns the catalogue: each component is an `Entry` in `REGISTRY`
(id, name, sig, icon, `Demo` or a full `Page` from `src/pages/`), grouped via
`GROUP_OF` into the `GROUPS` categories (Media, Data display, Navigation,
Inputs, Animation, Feedback, Layout, Hooks, Utilities). Routes are hash-based:
`/` is the single all-components catalogue, `/c/:id` the per-component page,
plus guide pages (`/start`, `/theming`).

**A library component isn't done until it has a `REGISTRY` entry with a live
demo.** Full-page demos (chat, job queue, command palette — see GOAL.md) get
their own pages under `src/pages/` and a `/demos` section.

## Releasing

Two registries, two purposes (details in [RELEASING.md](RELEASING.md)):

- **Public npm** (`@gabvdl/ui`) — CI publishes when a `v*` tag is pushed to
  the GitHub mirror. Human decision only.
- **Private verdaccio** — homelab dev builds, published on demand with
  `./services/registry/publish.sh` from the homelab repo root (bump the
  `packages/ui` version first). Lab projects consume WIP versions this way.

Breaking changes bump the **minor** (pre-1.0 policy in README); renamed props
keep a deprecated alias for at least one minor. Record user-visible changes in
`CHANGELOG.md`.

## Git remotes

`origin` is the homelab Gitea (`gitea.lab.gabvdl.xyz/gabrielvidal/design-system`)
— push via the `commit-project` skill (Authelia blocks plain HTTPS git). The
`github` remote (`GabrielVidal1/design-system`) is the public mirror that
drives the npm-publish CI; keep it in sync when pushing.
