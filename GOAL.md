# GOAL — where the design system is going

## North star

**A great mobile-first design system: every component needed to build a new
app or an online editor, so no homelab project ever rewrites a primitive
again.**

Two audiences, one library:

1. **App building** — starting a new project (a service frontend, a portfolio
   site, a tool) should need **zero one-off primitives**: layout, data
   display, data entry, navigation, feedback and media are all covered by
   `@gabvdl/ui`.
2. **Editor building** — the library is also the toolkit for **online web
   editors** — [zine-maker](../zine-maker), the marble machine, a card-game
   editor: canvas/stage surfaces, toolbars, inspector panels, layers,
   selection/transform, zoom-pan, undo/redo.

## Being worked on

<!-- Claims by goal-keeper agents. One bullet per in-flight item; the agent
     removes its own line in the same commit that ticks the checkbox. Leave
     the section empty (this comment only) when nothing is in flight. -->

- [design-system] `Sparkline` component (Data visualization category) — @2026-08-16T22:00Z

## Principles

1. **Mobile-first, desktop-compatible.** Designed for touch first (gestures,
   safe areas, `100dvh`, bottom sheets on phones) and scaling up to
   hover/keyboard/pointer — one API, no separate mobile variant.
2. **Complete by category, not by accident.** The coverage map below is the
   backlog; a category is done when a new app needs nothing hand-rolled.
3. **Tree-shakeable and tokened.** ESM, bundled types, every colour read from
   CSS custom properties so consumers retheme without touching components.
4. **Proven by demos.** A component isn't done until it's live on
   [ui.gabvdl.xyz](https://ui.gabvdl.xyz) — and the full-page demos prove the
   pieces compose into real app screens.

## Coverage map

What ships today vs. the known gaps, per docs category. Unchecked = to build.

### Layout
Has `ResizableLayout` (+ `Dock`), `FloatingPanel`, `PhonePreview`
(+ `PhoneKeyboard`).
- [ ] `AppShell` — header / collapsible sidebar / content scaffold, bottom nav
      on phones (the shape every service frontend rebuilds)
- [ ] Standalone `Drawer` / bottom sheet — still no exported primitive; the
      pattern keeps getting reimplemented inline (`Modal`, `ResizableLayout`'s
      `mobileMode: 'drawer'`, `Popover`/`Select`/`PalettePicker`'s mobile sheet)

### Data display
Has the `Progressive*` family (text, list, table, timeline, bash),
`VirtualList` (list **or** windowed card grid, via `columns`), `Collection`
(image+title items, cards ⇄ list toggle, optional fuzzy search), `Badge` /
`StatusBadge`, `RelativeTime`, `EmptyState`, `Skeleton`, `Changelog`.
- [x] `DataTable` — sortable/selectable table with sticky header, card
      collapse on phones
- [x] Stat tile / KPI row (every dashboard rebuilds one) — `StatTile` +
      `StatRow`, values tick via `CharRoll`
- [x] Progress bar (determinate — jobs, uploads) — `Progress`, tones shared
      with `StatusBadge`, indeterminate sweep

### Data entry
Has `Input`, `RichInput`, `SearchInput`, `DropZone`, `ElementPicker`,
`CopyButton`, `Select`, `Switch`, `Slider`, `FileEditor` (+ standalone
`CodeArea`, `Markdown`, `MenuBar`).
- [x] `Select` / combobox (searchable, mobile sheet mode)
- [x] `Switch` · `Slider` (was hand-rolled in 5+ projects each)
- [x] `Checkbox` · `Radio` · `Textarea`
- [x] `Field` wrapper — label + hint + error, so forms look uniform
- [x] `PhoneKeyboard` — pixel-traced Gboard (AZERTY/QWERTY, dark/light) that
      types, holds-delete and replaces text character by character through an
      imperative ref, with `PhoneTextField` as the composer it types into

### Navigation
Has `Tabs`, `Nav2D`, `GlobalSearch`, `FuzzyList`.
- [x] `Tabs` — scrolling strip, swipeable panels, underline/pill/segmented
- [x] `Menu` / context menu (long-press on touch) — `Menu` (click-triggered
      dropdown, anchored on desktop / bottom sheet on phones) + `ContextMenu`
      (right-click desktop, long-press touch, clamped to the viewport),
      sharing one keyboard-navigable list (arrows/Home/End/Enter, separators,
      disabled, `danger` tone). Built on `Popover`/`Modal`/`useLongPress`, not
      a new overlay primitive. Live demo + REGISTRY entry at `/c/menu`.
- [x] `Breadcrumbs`, pagination — collapsing "…" trail; desktop numbered
      pages, big-tap Prev/Next strip on phones

### Feedback
Has `Toast`, `Modal` / `useConfirm`, `Spinner`, `StatusBadge`.
- [x] `Tooltip` (touch-aware) and `Popover`
- [x] Banner / callout

### Media
Has `ImageViewer`, `ViewableImage`, `ProgressiveImage`, `IframePreview`.
Considered covered for now.

### Data visualization — new category, nothing shipped yet
No chart primitive exists in the library at all — `appe`'s
`TokenBreakdownPopover` pulls in `recharts` directly for a pie chart because
there's nothing to reuse, and any future stat dashboard (an ai-agent cost
panel, a dashboard demo below) will do the same unless this lands first.
Follow the homelab's own `dataviz` skill conventions (categorical/sequential
token palette, legible in both themes) rather than inventing a second color
system.
- [ ] `Sparkline` — inline trend line/bars for a `StatTile`, no axes/legend,
      tokened stroke/fill — the thing every dashboard hand-rolls in raw SVG
- [ ] `TrendChart` — small line-or-bar chart with hover tooltip, sized for a
      card, not a full analytics page
- [ ] `DonutChart` — share/breakdown ring with a centered total, the exact
      shape `appe`'s `TokenBreakdownPopover` reimplements with `recharts`

### Editor toolkit
The primitives online editors share, extracted so zine-maker, the marble
machine and a card-game editor don't each reinvent them:
- [x] `EditorStage` — zoom/pan canvas surface (wheel, pinch, space-drag) with
      a controlled viewport (shipped — `feat(ui): EditorStage`, merged; the
      checkbox was just never ticked)
- [x] `Toolbar` — tool groups, active state, overflow on small screens —
      + `ToolbarGroup` / `ToolbarButton` / `ToolbarSeparator`, ⋯ menu via
      ResizeObserver
- [x] `InspectorPanel` — property editing panel (pairs with `FloatingPanel` /
      `ResizableLayout` on desktop, bottom sheet on phones) —
      + `InspectorSection` / `InspectorRow`
- [ ] Layers list (reorder, visibility, selection) — this is `HoldEditable`'s
      drag-reorder + stash pattern reshaped into a flat list row (name, eye
      toggle, selected state), not a new drag primitive
- [ ] Selection & transform handles (move/scale/rotate, touch-friendly) —
      `react-moveable` (draggable/resizable/rotatable/snappable) is worth
      skimming for the gesture/handle-cursor API shape before designing ours
- [x] Color picker — `ColorPicker`: SV square, hue/alpha sliders, hex,
      eyedropper, swatches; HSV maths exported
- [ ] `useUndoRedo` + keyboard-shortcut manager

## Full-page demos

The docs site today is a per-component catalogue. Add a **Demos** section:
complete app screens built *only* from library components, each linking to
the components it uses.

- [x] Demos index (a `/demos` route with a card per demo)
- [x] **Chat** — an ai-agent-style page: `ResizableLayout` left/right
      drawers, animated message list, `RichInput` composer with chips
      (`/demos/chat` — "Agent console")
- [x] **Command palette / global search** — `GlobalSearch` + `FuzzyList`,
      fully keyboard- and touch-driven (`/demos/search` — "Switchboard")
- [x] **Job queue** — a 3d-gen / music-dl / brain-style service frontend:
      queue with `StatusBadge` + `RelativeTime` + progress, job detail with
      `ProgressiveBash` logs. *Missing primitives (progress bar, `DataTable`,
      stat tiles) get built in the library first.* (`/demos/jobs` — "Render
      queue")
- [ ] **Editor shell** — `EditorStage` + `Toolbar` + `InspectorPanel` +
      `ColorPicker` all ship today, so this no longer needs to wait on Layers
      or Selection/transform: build it now with a simple shape tool, add
      layers/selection to the demo once those primitives land
- [ ] **Dashboard** — pairs with the new Data visualization category:
      `StatRow` + `Sparkline`/`TrendChart` + `DataTable`, the screen every
      service frontend (3d-gen, music-dl, brain) currently improvises
- [ ] More over time — gallery, settings/forms page

## Guard rails (for the goal-keeper)

- One component **or** one demo per run, library-first: a new primitive lands
  in `packages/ui` with its docs entry before any demo uses it.
- Follow the conventions in [CLAUDE.md](CLAUDE.md) — tokens, tree-shaking,
  mobile-first, docs `REGISTRY` entry.
- Don't cut public npm releases from a scheduled run; publish work-in-progress
  to the private verdaccio instead (`services/registry/publish.sh` from the
  homelab root) and leave `v*` tagging to a human.

## Research log

<!-- Appended by the goal-seeder agent. Newest first. -->

### 2026-08-12 — seeded a Data visualization category, unblocked Editor shell

- Bookkeeping fix: `EditorStage` is merged, exported (`index.ts:333`) and live
  on the docs site, but its checkbox was never ticked — 3 hours of git history
  (`feat(ui): EditorStage`, `Merge branch 'editor-stage'`) had gone unrecorded.
  Ticked it; this also means the "Editor shell" demo was blocked on a fiction.
- `grep -rl "recharts" ~/projects/*/src` → `appe/src/components/TokenBreakdownPopover.tsx`
  imports `recharts` directly for a token-breakdown pie chart. The library has
  **no chart primitive in any form** — checked `index.ts` for
  Chart/Sparkline/Graph, nothing. Added a Data visualization category
  (`Sparkline`, `TrendChart`, `DonutChart`) so the next dashboard-shaped need
  (and a redo of `appe`'s chart) has something to reuse instead of a second
  charting dependency.
- Web search "react library selection transform handles resize rotate" →
  `react-moveable` (draggable/resizable/rotatable/scalable/snappable, one
  component) is the closest prior art for the still-unbuilt Selection &
  transform handles item; noted as a reference, not a dependency to pull in.
- Web search "shadcn ui new components 2026" → nothing changes the plan here:
  Command palette (`GlobalSearch`) and Data grid (`DataTable`) are already
  shipped; shadcn's move to Base UI over Radix doesn't apply since this
  library has no Radix dependency to begin with (`grep -i radix package.json`
  → no hits, it's built from scratch, not vendored shadcn primitives).
- `npm outdated`: nothing at a major-jump-with-real-payoff level worth a
  wishlist item — `react-resizable-panels` 2→4 and `lucide-react` 0→1 are
  majors but no release-note read surfaced a reason to migrate over a
  scheduled run; left for a human to judge.
- Considered and rejected: a Figma/Grida-style "AI-native" design-tool
  category (surfaced by the canvas-editor search) — the north star is a
  *component library*, not a design tool product; out of scope for this unit.
