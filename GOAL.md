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
Has `ResizableLayout` (+ `Dock`), `FloatingPanel`, `PhonePreview`.
- [ ] `AppShell` — header / collapsible sidebar / content scaffold, bottom nav
      on phones (the shape every service frontend rebuilds)
- [ ] Standalone `Drawer` / bottom sheet (today only implicit in `Modal`)

### Data display
Has the `Progressive*` family (text, list, table, timeline, bash),
`VirtualList` (list **or** windowed card grid, via `columns`), `Collection`
(image+title items, cards ⇄ list toggle, optional fuzzy search), `Badge` /
`StatusBadge`, `RelativeTime`, `EmptyState`, `Skeleton`, `Changelog`.
- [ ] `DataTable` — sortable/selectable table with sticky header, card
      collapse on phones
- [ ] Stat tile / KPI row (every dashboard rebuilds one)
- [ ] Progress bar (determinate — jobs, uploads)

### Data entry
Has `Input`, `RichInput`, `SearchInput`, `DropZone`, `ElementPicker`,
`CopyButton`.
- [ ] `Select` / combobox (searchable, mobile sheet mode)
- [ ] `Checkbox` · `Radio` · `Switch` · `Slider` · `Textarea`
- [ ] `Field` wrapper — label + hint + error, so forms look uniform

### Navigation
Has `Nav2D`, `GlobalSearch`, `FuzzyList`.
- [ ] `Tabs`
- [ ] `Menu` / context menu (long-press on touch)
- [ ] `Breadcrumbs`, pagination

### Feedback
Has `Toast`, `Modal` / `useConfirm`, `Spinner`, `StatusBadge`.
- [ ] `Tooltip` (touch-aware) and `Popover`
- [ ] Banner / callout

### Media
Has `ImageViewer`, `ViewableImage`, `ProgressiveImage`, `IframePreview`.
Considered covered for now.

### Editor toolkit — new category, mostly to build
The primitives online editors share, extracted so zine-maker, the marble
machine and a card-game editor don't each reinvent them:
- [ ] `EditorStage` — zoom/pan canvas surface (wheel, pinch, space-drag) with
      a controlled viewport
- [ ] `Toolbar` — tool groups, active state, overflow on small screens
- [ ] `InspectorPanel` — property editing panel (pairs with `FloatingPanel` /
      `ResizableLayout` on desktop, bottom sheet on phones)
- [ ] Layers list (reorder, visibility, selection)
- [ ] Selection & transform handles (move/scale/rotate, touch-friendly)
- [ ] Color picker
- [ ] `useUndoRedo` + keyboard-shortcut manager

## Full-page demos

The docs site today is a per-component catalogue. Add a **Demos** section:
complete app screens built *only* from library components, each linking to
the components it uses.

- [ ] Demos index (a `/demos` route with a card per demo)
- [ ] **Chat** — an ai-agent-style page: `ResizableLayout` left/right
      drawers, animated message list, `RichInput` composer with chips
- [ ] **Command palette / global search** — `GlobalSearch` + `FuzzyList`,
      fully keyboard- and touch-driven
- [ ] **Job queue** — a 3d-gen / music-dl / brain-style service frontend:
      queue with `StatusBadge` + `RelativeTime` + progress, job detail with
      `ProgressiveBash` logs. *Missing primitives (progress bar, `DataTable`,
      stat tiles) get built in the library first.*
- [ ] **Editor shell** — once the editor toolkit lands: stage + toolbar +
      inspector + layers in one screen
- [ ] More over time — dashboard, gallery, settings/forms page

## Guard rails (for the goal-keeper)

- One component **or** one demo per run, library-first: a new primitive lands
  in `packages/ui` with its docs entry before any demo uses it.
- Follow the conventions in [CLAUDE.md](CLAUDE.md) — tokens, tree-shaking,
  mobile-first, docs `REGISTRY` entry.
- Don't cut public npm releases from a scheduled run; publish work-in-progress
  to the private verdaccio instead (`services/registry/publish.sh` from the
  homelab root) and leave `v*` tagging to a human.
