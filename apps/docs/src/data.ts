// Specimen plates for the live demo. Real photographs (via Lorem Picsum) so the
// image viewer has genuine detail to zoom into — the whole point of the flagship
// component. Each has a small `thumb` for the grid and a large `full` the viewer
// loads on open.

export interface Specimen {
  id: number;
  label: string;
  alt: string;
}

const PICSUM = 'https://picsum.photos/id';

export const thumbUrl = (id: number) => `${PICSUM}/${id}/640/480`;
export const fullUrl = (id: number) => `${PICSUM}/${id}/1800/1350`;

/** The full catalogue — a dozen plates filed in cyanotype. */
export const specimens: Specimen[] = [
  { id: 1039, label: 'Plate I', alt: 'Cyanotype specimen — alpine reservoir' },
  { id: 1043, label: 'Plate II', alt: 'Cyanotype specimen — timber and rail' },
  { id: 1015, label: 'Plate III', alt: 'Cyanotype specimen — river bend' },
  { id: 1018, label: 'Plate IV', alt: 'Cyanotype specimen — ridge line' },
  { id: 1025, label: 'Plate V', alt: 'Cyanotype specimen — study of a hound' },
  { id: 1074, label: 'Plate VI', alt: 'Cyanotype specimen — study of a leopard' },
  { id: 1062, label: 'Plate VII', alt: 'Cyanotype specimen — harvest table' },
  { id: 129, label: 'Plate VIII', alt: 'Cyanotype specimen — desk and instruments' },
  { id: 145, label: 'Plate IX', alt: 'Cyanotype specimen — folded terrain' },
  { id: 164, label: 'Plate X', alt: 'Cyanotype specimen — still water' },
  { id: 142, label: 'Plate XI', alt: 'Cyanotype specimen — quiet street' },
  { id: 1024, label: 'Plate XII', alt: 'Cyanotype specimen — study of a wolf' },
];

/** The image URLs in catalogue order — the carousel set the viewer walks. */
export const specimenFulls = specimens.map((s) => fullUrl(s.id));

// A JSON dataset for the FuzzyList demo — a slice of the homelab, searched by
// name / kind / description. Any array of plain objects works the same way.
export interface Node {
  name: string;
  kind: 'service' | 'project' | 'box';
  host: string;
  desc: string;
}

export const nodes: Node[] = [
  { name: 'traefik', kind: 'service', host: 'traefik.lab', desc: 'v3 reverse proxy, TLS, forward-auth entrypoint for every service' },
  { name: 'authelia', kind: 'service', host: 'auth.lab', desc: 'forward-auth identity provider, the login wall in front of the lab' },
  { name: 'ai-agent', kind: 'service', host: 'ai-agent.lab', desc: 'Claude Code conversation archive + live viewer, blue-green deployed' },
  { name: 'gitea', kind: 'service', host: 'gitea.lab', desc: 'self-hosted git forge, scoped-token push behind Authelia' },
  { name: 'grafana', kind: 'service', host: 'grafana.lab', desc: 'dashboards over Loki logs and Prometheus metrics' },
  { name: '3d-gen', kind: 'service', host: '3d-gen.lab', desc: 'image to textured glb via TRELLIS.2 on the EVOX2 box' },
  { name: 'image-gen', kind: 'service', host: 'image-gen.lab', desc: 'prompt to image, Nano Banana or local Ideogram 4' },
  { name: 'music-dl', kind: 'service', host: 'music-dl.lab', desc: 'paste a Spotify link, spotDL downloads and beets autotags' },
  { name: 'sherlock-project', kind: 'project', host: 'sherlock-project.dev', desc: 'styles gallery, source of the image viewer this library ships' },
  { name: 'note-vite', kind: 'project', host: 'note.dev', desc: 'offline-first notes on PocketBase + RxDB, the phone-preview demo' },
  { name: 'insta-pics', kind: 'project', host: 'pics', desc: 'self-hosted photo profile, direct-PocketBase public read' },
  { name: 'zine-maker', kind: 'project', host: 'tools.zine.dev', desc: 'browser mini-zine maker, PDF importer + Konva editor' },
  { name: 'EVOX2', kind: 'box', host: '100.93.171.39', desc: 'Ryzen AI MAX+ 395 Strix Halo, Radeon 8060S iGPU, 96GB unified VRAM' },
  { name: 'raspy2', kind: 'box', host: '100.74.118.12', desc: 'public-facing edge, zipgo/Caddy serves gabvdl.xyz over Tailscale' },
];

// The real changelog history for the Changelog demo, straight from this repo's
// own git log (see CHANGELOG.md at the repo root) — enough entries to page
// through (infinite load) and to virtualize.
import type { ChangelogEntry } from '@gabvdl/ui';

export const changelog: ChangelogEntry[] = [
  {
    version: '0.1.3',
    date: '2026-07-13',
    title: 'Panels open and close like tabs',
    changes: [
      'FloatingPanel: `closable` — a panel closes into its dock instead of being unmounted by the parent, and the dock grows a "+" that brings it back',
      'FloatingPanel: `defaultClosed`, `keepMounted`, and `open()`/`close()`/`isClosed()` on the imperative handle',
      'FloatingPanel: children now genuinely survive float ⇄ dock (and close ⇄ open with `keepMounted`) — the body rides a stable portal holder instead of remounting',
      'Dock: `tabs: "always"`, a close affordance on each tab, and a "+" menu listing the closed panels',
      'Add `useDock(id)` — read a dock\'s open/closed panels and drive them; `isEmpty` is what collapses the region hosting it',
      'ResizableLayout: desktop `collapsedSize` (px) — a collapsed drawer can keep a strip on screen (a dock\'s "+" bar) instead of vanishing',
    ],
  },
  {
    version: '0.1.0',
    date: '2026-07-13',
    title: 'First beta cut',
    changes: [
      'Converge controlled-callback prop names on `on<X>Change`; old names kept as deprecated aliases',
      'Add the first test suite (Vitest + Testing Library), wired into CI',
      'Ship LICENSE (MIT) at the repo root and in the package',
      'Add a real CHANGELOG.md, reconstructed from git history',
      'Docs: add Getting started, Theming, and progressive-timeline pages',
      'Fix props tables for components whose props are declared as a type alias',
    ],
  },
  {
    version: '0.0.14',
    date: '2026-07-13',
    title: 'Publish @gabvdl/ui to public npm',
    changes: [
      'Reset to a fresh 0.0.x alpha line for the public registry, publishConfig.access=public',
      'GitHub mirror + tag-triggered CI release workflow (typecheck, build, npm publish --provenance)',
      'Fix CI publish EOTP errors — support bypass-2FA tokens and OIDC trusted publishing',
    ],
    sha: 'ea7e64f',
  },
  {
    version: '0.16.0',
    date: '2026-07-13',
    title: 'ElementPicker',
    changes: [
      'Add ElementPicker / ElementPickerField — point at a page and take it apart: hover box-model overlay, click to select, touch hold + drag',
      'Ships useElementPicker as a standalone headless hook',
    ],
    sha: '3f9c5c2',
  },
  {
    version: '0.15.0',
    date: '2026-07-13',
    title: 'RichInput: drop files',
    changes: [
      'Drag-and-drop files onto the RichInput composer, through the same accept/maxFiles/fileFilter checks as a pick',
      'Fix an IframePreview props type that broke the dts build',
    ],
    sha: 'f51dde0',
  },
  {
    version: '0.14.0',
    date: '2026-07-13',
    title: 'ResizableLayout: per-side mobile behaviour',
    changes: [
      "Add per-side `mobileMode`: 'drawer' (overlay, focus-taking) or 'panel' (stays in the flow, splits the screen)",
    ],
    sha: 'fa0a226',
  },
  {
    version: '0.13.0',
    date: '2026-07-13',
    title: 'GlobalSearch + Cmd-K',
    changes: [
      'Add GlobalSearch — a Cmd-K palette built from Modal + FuzzyList + VirtualList',
      'FuzzyList gains a debounced search pass and documented quote-aware exact match',
      'Docs: build-time search index over every component, hook, util and prop',
      'Docs: per-component props tables generated from that same index',
    ],
    sha: '9b85f26',
  },
  {
    version: '0.12.0',
    date: '2026-07-13',
    title: 'ResizableLayout: top/bottom drawers',
    changes: [
      'ResizableLayout now supports all four sides — top/bottom get a vertical PanelGroup + swipeable overlay',
      'Deploy ui.gabvdl.xyz with the ResizableLayout drawer card',
    ],
    sha: '0cb4302',
  },
  {
    version: '0.11.0',
    date: '2026-07-12',
    title: 'RichInput: exclusive tag groups',
    changes: [
      'RichInput: exclusive (radio-style) tag groups',
      'Docs: redesign all 31 component card SVGs on one shared ease-in-out motion system',
    ],
    sha: '29fcf7d',
  },
  {
    version: '0.10.0',
    date: '2026-07-12',
    title: 'IframePreview',
    changes: [
      'Add IframePreview / IframePreviewOverlay — full-screen controlled iframe with an editable address bar and a real (non-cached) reload',
    ],
    sha: 'df91c42',
  },
  {
    version: '0.9.0',
    date: '2026-07-12',
    title: 'Button overhaul',
    changes: [
      'Button: sm/md/lg size tiers with icon-only twins, loading state, icon slot, portalled tooltip',
    ],
    sha: 'b209a08',
  },
  {
    version: '0.8.0',
    date: '2026-07-12',
    title: 'Shared primitives wave',
    changes: [
      'Add ToastProvider/useToast, Modal/useModal/useConfirm, ThemeToggle/useTheme',
      'Add Spinner/Skeleton/EmptyState, Badge/StatusBadge, SearchInput/DropZone/CopyButton/RelativeTime',
      "Add the shared hooks and format module lifted out of the homelab's other projects",
    ],
    sha: '1335a4b',
  },
  {
    version: '0.7.0',
    date: '2026-07-11',
    title: 'ResizableLayout',
    changes: [
      'Add ResizableLayout — resizable/collapsible drawers on desktop, swipeable overlays on mobile',
    ],
    sha: 'a4fe4f2',
  },
  {
    version: '0.6.0',
    date: '2026-07-11',
    title: 'ProgressiveBash + FloatingPanel',
    changes: [
      'Add ProgressiveBash — a replayed, syntax-colored terminal session',
      'Add FloatingPanel/Dock — drag-to-float, drag-to-dock windows',
      'ProgressiveBash: catch-up on load, sticky prompt, echo subparts split into sequential commands',
    ],
    sha: '354d1de',
  },
  {
    version: '0.5.0',
    date: '2026-07-11',
    title: 'RichInput: guidelines switch',
    changes: ['RichInput: guidelines master switch and a scrollable tag-group list'],
    sha: '4e71d01',
  },
  {
    version: '0.4.0',
    date: '2026-07-11',
    title: 'Docs: light theme',
    changes: [
      'RichInput: expose a setFiles imperative handle',
      "Docs: light technical theme, catalogue grouped by category, embedded read-only IDE per component",
    ],
    sha: '2e36d76',
  },
  {
    version: '0.3.0',
    date: '2026-07-11',
    title: 'RichInput composer',
    changes: [
      'Add RichInput — the ai-agent composer factored into hooks: draft, un-send, files, guidelines, mention, history',
      'FuzzyList: quote-aware exact match, estimateSize/overscan props',
    ],
    sha: '895257e',
  },
  {
    version: '0.2.1',
    date: '2026-07-11',
    title: 'VirtualList: smooth-reorder',
    changes: ['VirtualList: smooth-reorder animation when a sorted list changes order'],
    sha: '2acf26b',
  },
  {
    version: '0.2.0',
    date: '2026-07-11',
    title: 'ProgressiveTable',
    changes: ['Add ProgressiveTable — header-first, row-by-row table reveal on the progressive-timeline'],
    sha: '8d8b4ef',
  },
  {
    version: '0.1.1',
    date: '2026-07-11',
    title: 'Progressive timeline context',
    changes: [
      'Add the progressive-timeline context so ProgressiveList waits on nested inner animations',
      'Add ProgressiveText and ProgressiveList',
    ],
    sha: '1e99555',
  },
  {
    version: '0.1.0',
    date: '2026-07-11',
    title: 'Initial release',
    changes: [
      'Monorepo scaffold: @gabvdl/ui + cyanotype docs',
      'Flagship ImageViewerProvider/ViewableImage/ProgressiveImage, Button, Input',
      'Add FuzzyList, PhonePreview, VirtualList, Changelog',
      'Add Nav2D — joystick + 2D-raycast spatial navigation',
      'Input: cacheKey/cacheLocation localStorage persistence',
    ],
    sha: '4e16193',
  },
];
