# Changelog

All notable changes to `@gabvdl/ui` (and its docs app) are recorded here. The
format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
During `0.x` the project follows the deviation from strict semver spelled out
in the [README](README.md): from `0.1.0` on, breaking changes bump the
**minor**, and renamed props keep a deprecated alias for at least one minor.

## [Unreleased]

## [0.1.5] - 2026-07-14

### Added

- `RichInput`: **`renderSendButton`** — replace the built-in send button
  entirely. Receives `{ canSend, submit }`, so a caller can layer a long-press
  gesture, a split button, or any other custom control on top of the same
  submit path the default button uses.

## [0.1.4] - 2026-07-13

### Fixed

- `ResizableLayout`: a drawer that *mounted* collapsed reopened at `minSize`
  instead of its `defaultSize` — the panel had no pre-collapse size to restore,
  so `expand()` fell back to the minimum. Its first expand is now seeded with
  `defaultSize`; after that the panel's own memory wins, so a deliberately small
  dragged size still survives a close/open round-trip. Shows up wherever a
  drawer starts closed — e.g. a `Dock` whose panels are all closed, which opened
  as a sliver on the first "+".

## [0.1.3] - 2026-07-13

### Added

- `FloatingPanel`: **`closable`** — the panel closes itself into the `closed`
  placement instead of relying on the parent to unmount it. It stays registered,
  so its `Dock` grows a **"+"** button that brings it back: one closed panel
  reopens on click, several give a small menu. A parent no longer keeps an
  `isOpen` flag per panel, and a closed panel can't become unreachable.
- `FloatingPanel`: `defaultClosed` (start as nothing but a "+" entry),
  `keepMounted` (keep the body alive while closed, so a half-typed draft
  survives), `label`, and `open()` / `close()` / `isClosed()` on the imperative
  handle.
- `Dock`: `tabs: 'always'` to keep the strip up for a lone panel, a close
  affordance on each tab, and the "+" button and its menu.
- `useDock(id)` — a dock's open/closed panels, active tab, and the actions to
  move panels between those states. Its `isEmpty` is what a host layout watches
  to collapse the region holding the dock.
- `ResizableLayout`: desktop **`collapsedSize`** (in pixels, the counterpart of
  `mobileCollapsedSize`) — a collapsed drawer keeps that many pixels on screen
  instead of vanishing, which is what lets a dock stay reachable as just its "+"
  strip. Resolved against the layout's live box, so it holds at any viewport.

### Fixed

- `FloatingPanel`: children no longer remount when a panel moves between
  placements. The body now rides a stable portal holder that is *moved* between
  mount points, so component state genuinely survives float ⇄ dock (as the docs
  already claimed) and close ⇄ open under `keepMounted`.

## [0.1.1] - 2026-07-13

### Added

- `ResizableLayout`: mobile `'panel'` sides are now drag-resizable from a grip
  on their inner edge (touch or pointer). The dragged size overrides
  `mobileWidth`/`mobileHeight` and persists per side under the layout's
  `autoSaveId`. Opt out per side with `mobileResizable: false`.
- `RichInput`: new `fill` prop — stretch to the parent's height with the
  textarea taking all the space the chip/toolbar rows leave, instead of
  auto-growing between `minRows`/`maxRows`. For hosting the composer inside a
  resizable panel (e.g. a `FloatingPanel`).

## [0.1.0] - 2026-07-13

First beta cut — the point where the library stops being a fast-moving grab
bag of components and starts being something you can build on.

### Changed

- Controlled-callback prop names converged on the `on<X>Change` convention
  library-wide. Old names (e.g. per-component one-offs predating the
  convention) are deprecated but kept as aliases — nothing breaks today.
- Docs site's displayed version is now read from the `@gabvdl/ui` package
  itself instead of being hand-typed per page.
- Fixed the build-time props-table generator for components whose props are
  declared as a type alias (`type XProps = { … }`) rather than an inline
  destructured signature — these previously rendered an empty table.

### Added

- First test suite (Vitest + Testing Library), wired into CI alongside the
  existing typecheck/build checks.
- `LICENSE` (MIT) at the repo root and inside `packages/ui`, so the npm
  package carries one.
- This changelog.
- Docs gained a **Getting started** page and a **Theming** page, plus a
  dedicated page for the progressive-timeline system (`ProgressiveTimelineSlot`
  / `useProgressiveSlot`) that had only ever been documented inline on the
  `ProgressiveList` demo.

### Fixed

- `useTheme` in `system` mode: a live OS `prefers-color-scheme` flip updated
  the DOM class but never re-rendered subscribers, so anything reading
  `resolved`/`isDark` (e.g. the `ThemeToggle` icon) went stale until an
  unrelated re-render. The store snapshot now carries the resolved theme.
  Found by the new test suite.

## 0.0.x — beta groundwork (2026-07-11 – 2026-07-13)

Everything below shipped under the `0.0.x` public-alpha line before this
release. Summarized by theme rather than by commit — see `git log` for the
full detail.

### Initial cut

Monorepo scaffold (npm workspaces + turbo): `@gabvdl/ui` as a tree-shakeable
ESM library on shadcn primitives, and `apps/docs` as the catalogue + live demo
site, first art-directed as a cyanotype specimen sheet. Flagship
`ImageViewerProvider` / `useImageViewer` / `ViewableImage` / `ProgressiveImage`
(a full-screen zoom/pan/swipe image viewer, ported from the Sherlock project),
plus `Button`, `Input` and the `cn` class helper.

### Search & lists

`FuzzyList<T>` (Fuse.js fuzzy search over any array, quote-aware exact-match,
debounced, `<mark>` highlighting) and `VirtualList<T>` (windowed/infinite,
TanStack Virtual, smooth-reorder animation) became the shared foundation for
every searchable or long list in the library. `GlobalSearch` assembled them
into a Cmd-K palette, backed by a Vite plugin that walks `packages/ui/src`
with the TypeScript compiler API to emit a build-time search index — one
entry per exported symbol and per prop, each carrying its TSDoc and type. That
same index later grew into the per-component props tables shown under every
usage example. `PhonePreview` (dependency-free iPhone mockup) and `Changelog`
(the changelog-widget SDK, folded into the library) rounded out the wave.

### Progressive animation family

A set of composable reveal primitives: `ProgressiveText` (character-by-character,
diffs against live/streamed text), `ProgressiveList` (item-by-item, append-only
aware), `ProgressiveTable` (header-first, row-by-row) and `ProgressiveBash` (a
replayed, syntax-colored terminal session with catch-up-on-load and sticky
prompts). A `progressive-timeline` context lets nested progressive children
report their own animation duration so a parent list waits for each row's
inner animation before revealing the next — turning a fixed-rate reveal into
an ordered timeline. `FloatingPanel` / `Dock` (drag-to-float, drag-to-dock
windows) shipped alongside as the layout these terminals live in.

### RichInput composer

The ai-agent chat composer, factored into a generic component built from
independent hooks: drafts persisted to storage (`useDraft`), a hold-to-send
undo window, multi-file upload with paste-to-attach (`useFileUpload`) and
drag-and-drop onto the composer, toggleable guideline/tag chips including
exclusive (radio-style) tag groups (`useGuidelines`), `#`-prefix mention
autocomplete (`useMention`), and shell-style input history with reverse search
(`useInputHistory`).

### Shared primitives wave (v0.8)

The wave lifted straight out of the homelab's other projects, each of which
had rewritten the same handful of things independently: `ToastProvider` /
`useToast`, `Modal` / `useModal` / `useConfirm` (with a bottom sheet on
phones), `ThemeToggle` / `useTheme`, `Spinner` / `Skeleton` / `EmptyState`,
`Badge` / `StatusBadge`, `SearchInput` / `DropZone` / `CopyButton` /
`RelativeTime`, a grab-bag of hooks (`useMediaQuery`, `useLocalStorage`,
`useLongPress`, `useCopyToClipboard`, `useIntersection` /
`useInfiniteScroll`, `useScrollLock`, `useEscape`, `useOutsideClick`) and a
`format` module (`relTime`, `fmtDuration`, `fmtBytes`, `fmtNum`, `fmtCost`,
`downloadFile`).

### Layout & navigation

`ResizableLayout` — resizable/collapsible drawers on desktop, swipeable
overlays on mobile, on all four sides, with a per-side `mobileMode` choice
between a focus-taking drawer and a screen-splitting panel. `Nav2D` — joystick
+ 2D-raycast spatial navigation for touch-first interfaces. `IframePreview` —
a full-screen controlled iframe preview with an editable address bar and a
real (non-cached) reload.

### ElementPicker

A page inspector as a data input: hover to draw the devtools box model,
click to select, press-and-hold + drag for the touch equivalent. Hands back
the live DOM node plus a serializable parse (kind, text, selector, hierarchy,
computed styles, HTML) — built to hand an LLM or a bug report the exact piece
of a page you mean.

### Button overhaul

Three size tiers each with an icon-only twin, a `loading` state (spinner
swap, `aria-busy`, `sr-only` status text), an icon slot, and an optional
portalled tooltip that doubles as the accessible name on icon-only buttons.

### Docs redesign

Rebuilt as a serious, simple, light technical theme (single blue accent, no
serif); the catalogue grouped by category; a per-component page pairing the
live demo with a read-only embedded IDE (Sandpack) showing usage and full
source. Later, all 31 component card animations were redrawn on one shared
ease-in-out motion system.

### Publishing to npm

`@gabvdl/ui` moved onto the public npm registry: a GitHub mirror
(`GabrielVidal1/design-system`) runs the tag-triggered release workflow,
publishing a fresh `0.0.x` line with provenance. A follow-up fix worked around
npm's `EOTP` 2FA requirement (classic "Automation" tokens were retired) by
supporting both a bypass-2FA granular token and OIDC trusted publishing.

[Unreleased]: https://github.com/GabrielVidal1/design-system/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/GabrielVidal1/design-system/releases/tag/v0.1.0
