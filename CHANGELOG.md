# Changelog

All notable changes to `@gabvdl/ui` (and its docs app) are recorded here. The
format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
During `0.x` the project follows the deviation from strict semver spelled out
in the [README](README.md): from `0.1.0` on, breaking changes bump the
**minor**, and renamed props keep a deprecated alias for at least one minor.

This file is also machine-read: `gabvdl-changelog from-md` (bundled with the
package) compiles it to the `changelog.jsonl` that the docs site's
`/changelog` page, changelog modal and new-version toast consume. A `> quoted`
line directly under a version heading becomes that release's display title.
Draft a release with `gabvdl-changelog draft` (conventional commits since the
last release → grouped bullets under Unreleased), then curate the prose.

## [Unreleased]

### Added

- `Tabs` (`Tabs` · `TabsList` · `TabsTrigger` · `TabsContent`) — the tabbed
  panel every app rebuilds, touch-first. The strip **scrolls** instead of
  wrapping and keeps the active tab in view; on touch the panels are
  **swipeable** (axis-locked on the first decisive movement, so a vertical
  scroll is never turned into a tab change, and a gesture starting on the strip
  or inside a horizontally scrollable child is left alone). Three variants —
  `underline`, `pill`, `segmented` — the first and last moving a measured
  indicator between tabs. Full ARIA tabs pattern: roving tabindex, `←`/`→`
  wrapping arrow keys, `Home`/`End`, and `activation="manual"` to move focus
  without selecting (for panels that fetch on select). `keepMounted` keeps an
  inactive panel in the DOM so it holds its scroll and form state.

## [0.4.1] - 2026-07-14

> The CLI actually runs

### Fixed

- `gabvdl-changelog` silently did nothing when invoked through the npm `.bin`
  symlink (`npx gabvdl-changelog`): the ESM "am I the entrypoint" check
  compared `import.meta.url` (real path) against `process.argv[1]` (the
  symlink). Both sides now resolve through `realpath`.

## [0.4.0] - 2026-07-14

> One changelog everywhere

### Added

- **`ChangelogPage`** — the full release history as an anchored page
  (`id="v1.2.3"` per release) for a `/changelog` route; same data, same entry
  rendering as the modal. The docs site's new
  [Changelog page](https://ui.gabvdl.xyz/#/changelog) is the live demo.
- **`useChangelog`** — the data layer as a hook: `entries`, `latest`, and a
  `newVersion` + `dismissNewVersion` pair for driving a custom update prompt.
  `watch: true` polls for new versions (pauses while the tab is hidden).
- **`NewVersionToast`** — the "new version → reload" toast standalone, for
  apps that want the prompt without a changelog trigger.
- **`gabvdl-changelog`** — a zero-dependency CLI bundled with the package
  (`npx gabvdl-changelog`). Three modes: `build` regenerates
  `public/changelog.jsonl` from conventional commits (seed once, then one
  bundled version per deploy); `from-md` compiles a curated Keep-a-Changelog
  `CHANGELOG.md` — sections preserved — for published packages like this one;
  `draft` fills `[Unreleased]` from commits since the last release, idempotent
  by short sha, ready for human curation.
- `ChangelogEntry.sections` — optional Keep-a-Changelog categories
  (added/changed/fixed/… plus `breaking`); the modal and page render grouped
  section labels when present, flat bullets otherwise.
- Everything data-side is exported for custom UIs: `parseChangelog`,
  `fetchChangelog`, `watchChangelog`, `latestEntry`, `compareSemver`,
  `isSemver`, and the shared `ChangelogEntryView`.

### Changed

- `Changelog` no longer loads the hosted changelog-widget SDK script — the
  fetch/parse/poll data layer is built in, so it works offline, in dev, and
  with no external dependency. The `sdkUrl` prop is deprecated (accepted,
  ignored).
- Docs: the changelog demo, the new `/changelog` page and the site's own
  update toast all read `public/changelog.jsonl`, generated from this file at
  build time — the hand-maintained copy of the history in `data.ts` (already
  stale at 0.1.4) is gone. The retired pre-npm `0.x` line was dropped from the
  displayed history: its versions (`0.16.0`, …) would out-sort the current
  line; it remains in git history.

## [0.3.0] - 2026-07-14

> Search results that glide

### Added

- **`FuzzyList`** — forwards **`smooth`** (plus `smoothDuration` / `smoothEasing`)
  to its underlying `VirtualList`, so the results can glide to their new slots
  instead of teleporting. A fuzzy list re-ranks on *every keystroke*, which makes
  this the reorder users see most often. Needs a stable `getItemKey`, as ever;
  off by default.
- **`VirtualList`** — the `smooth` reorder is now tunable and legible.
  - `smoothDuration` (ms) and `smoothEasing` set the pace and the curve of the
    glide, published to the CSS as `--ds-virtual-row-duration` /
    `--ds-virtual-row-ease` on each row.
  - A row travelling **up** is now stacked over the rows it overtakes (which are,
    by definition, sliding down to make room), so a swap reads as one card
    passing in *front* of another instead of disappearing behind it. The lift is
    held for exactly the length of the transition and released when the row
    settles.

### Fixed

- **`VirtualList`** — the rows sliding *down* during a `smooth` reorder snapped
  into place instead of gliding; only the climbing rows animated. The rows are
  rendered in a **stable DOM order** now, keyed to a remembered sibling slot,
  instead of in rank order. React was reordering the nodes on every re-sort, and
  re-inserting an element discards the transform it was interpolating from — so
  the browser dropped the transition and the row teleported. Rows are positioned
  purely by `transform`, so pinning the DOM order costs nothing visually (paint
  order is what the rising z-index governs) and every moving row now glides.

### Changed

- **`VirtualList`** — `smooth` defaults are slower and eased in *and* out:
  **520ms** (was 320ms) on a `cubic-bezier(0.65, 0, 0.35, 1)` ease-in-out (was
  the ease-out `cubic-bezier(0.22, 1, 0.36, 1)`). The old feel is
  `smoothDuration={320} smoothEasing="cubic-bezier(0.22, 1, 0.36, 1)"`.

## [0.2.0] - 2026-07-14

> Collection: cards ⇄ list

### Added

- **`Collection`** — the generic "things with a picture and a name" list, with a
  **toggle between a card grid and a compact list**. Give it `items`, a
  `getTitle` and (optionally) a `getImage`; it owns the two layouts, the
  segmented toggle, lazy image loading, and the empty/loading states.
  - Generic by design: `renderMeta` / `renderActions` / `renderOverlay` for
    slots, and `renderCard` / `renderRow` to replace an item outright. Every
    render prop is told which `view` it's in, so a row and a card can differ.
  - The toggle is controlled (`view` + `onViewChange`), uncontrolled
    (`defaultView`), or **persisted** across reloads with `persistKey`.
  - `emptyState` and `noMatchesState` are separate: "this collection has nothing
    in it" and "your search matched none of these" are different messages. The
    search box stays mounted while `loading`, so a typed query survives a
    refetch, and the placeholders are shaped like the view they stand in for
    (a card grid, or a stack of rows).
  - **Composes instead of duplicating**: both views are windowed by `VirtualList`
    (cards included), pictures blur-up load through `ProgressiveImage` only as
    they near the viewport, and passing **`searchKeys`** routes the whole thing
    through `FuzzyList` — adding quote-aware fuzzy search, `<mark>` highlighting
    (in the item titles) and keyboard navigation, with the toggle docked into the
    search bar. No second copy of any of that logic.

- **`VirtualList`: `columns`** — lay the items out as a **card grid** instead of
  a single column, and still window them: items are chunked into rows of N and
  the virtualizer measures one *row* at a time, so a thousand cards cost what a
  thousand rows do. Takes a number or a responsive map
  (`{ base: 2, md: 3, lg: 4 }`); `gap` sets the cell spacing. Defaults to `1`,
  which takes the original single-column code path unchanged.

- **`FuzzyList`: `columns` / `gap`** — forwarded to `VirtualList`, so search
  results can be a card grid. The keyboard cursor becomes 2-D in grid mode: ↑/↓
  move a whole row, ←/→ step one card. Unchanged (±1, ↑/↓ only) in list mode.

### Fixed

- `useMediaQuery` (and everything built on it — `useIsMobile`, `useIsTouch`,
  `usePrefersDark`, `usePrefersReducedMotion`) threw where `window` exists but
  `matchMedia` doesn't — some test DOMs and non-browser renderers. It now
  degrades to `false` (i.e. "no query matches", so a responsive layout falls back
  to its base breakpoint) rather than crashing the component that called it.

## [0.1.5] - 2026-07-14

> Bring your own send button

### Added

- `RichInput`: **`renderSendButton`** — replace the built-in send button
  entirely. Receives `{ canSend, submit }`, so a caller can layer a long-press
  gesture, a split button, or any other custom control on top of the same
  submit path the default button uses.

## [0.1.4] - 2026-07-13

> Drawers that mount collapsed

### Fixed

- `ResizableLayout`: a drawer that *mounted* collapsed reopened at `minSize`
  instead of its `defaultSize` — the panel had no pre-collapse size to restore,
  so `expand()` fell back to the minimum. Its first expand is now seeded with
  `defaultSize`; after that the panel's own memory wins, so a deliberately small
  dragged size still survives a close/open round-trip. Shows up wherever a
  drawer starts closed — e.g. a `Dock` whose panels are all closed, which opened
  as a sliver on the first "+".

## [0.1.3] - 2026-07-13

> Panels open and close like tabs

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

> Mobile drag-resize

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

> First beta cut

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

[Unreleased]: https://github.com/GabrielVidal1/design-system/compare/v0.4.1...HEAD
[0.4.1]: https://github.com/GabrielVidal1/design-system/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/GabrielVidal1/design-system/compare/v0.1.0...v0.4.0
[0.1.0]: https://github.com/GabrielVidal1/design-system/releases/tag/v0.1.0
