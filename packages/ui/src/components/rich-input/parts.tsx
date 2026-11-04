import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  CornerDownRight,
  File as FileIcon,
  History,
  ListChecks,
  Search,
  TriangleAlert,
  Undo2,
  X,
} from 'lucide-react';

import { cn } from '../../lib/utils';
import { useSwipeDismiss } from '../../hooks/use-swipe-dismiss';
import { VirtualList } from '../virtual-list';
import { tagSlug } from './use-mention';
import { motionAllowed, openRoom, useFlipPop, usePopOut, usePresence } from './motion';
import type { MasterSwitchConfig, RichTag, RichFile } from './types';
import {
  LINEAR_EASING,
  curveKeyframes,
  evalCurve,
  type AnimationCurve,
  type CurveEasing,
} from '../curve-editor/curve';

export function fmtBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
}

/* ── Attachments ─────────────────────────────────────────────────────────── */
export function AttachmentChips({
  files,
  onRemove,
}: {
  files: RichFile[];
  onRemove: (id: string) => void;
}) {
  if (files.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 px-1 pb-1.5">
      {files.map((f) => {
        const isImage = f.contentType.startsWith('image/') && f.url;
        return (
          <span
            key={f.id}
            className="group inline-flex max-w-[13rem] items-center gap-1.5 rounded-md border border-input bg-background/60 py-1 pl-1.5 pr-1 text-xs"
          >
            {isImage ? (
              <img src={f.url} alt="" className="size-5 shrink-0 rounded object-cover" />
            ) : (
              <FileIcon className="size-3.5 shrink-0 text-muted-foreground" />
            )}
            <span className="min-w-0 truncate text-foreground">{f.name}</span>
            <span className="shrink-0 text-[10px] text-muted-foreground">{fmtBytes(f.size)}</span>
            <button
              type="button"
              aria-label={`Remove ${f.name}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onRemove(f.id)}
              className="ml-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          </span>
        );
      })}
    </div>
  );
}

/* ── A single toggle chip ────────────────────────────────────────────────── */
function TagChip({
  tag,
  on,
  onToggle,
  suggested = false,
  leaving = false,
}: {
  tag: RichTag;
  on: boolean;
  onToggle: (id: string) => void;
  /** Matched in the text but not picked: a dashed outline, a tap links it. */
  suggested?: boolean;
  /** On its way out (see `usePresence`): shown, but no longer tappable. */
  leaving?: boolean;
}) {
  const label = on ? tag.label : (tag.labelOff ?? tag.label);
  const depth = Math.max(0, Math.min(tag.depth ?? 0, 4));
  return (
    <button
      type="button"
      aria-pressed={on}
      data-motion-key={tag.id}
      data-motion-leaving={leaving || undefined}
      tabIndex={leaving ? -1 : undefined}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => !leaving && onToggle(tag.id)}
      style={depth > 0 ? { marginLeft: depth * 10 } : undefined}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors',
        leaving && 'pointer-events-none',
        on
          ? 'border-primary/40 bg-primary/10 text-foreground'
          : suggested
            ? 'border-dashed border-muted-foreground/50 text-muted-foreground hover:border-primary/50 hover:text-foreground'
            : 'border-input text-muted-foreground hover:text-foreground',
      )}
    >
      {/* A nested chip announces its parent with a corner marker, so a revealed
          child reads as belonging to the chip before it. */}
      {depth > 0 && <CornerDownRight className="-ml-0.5 size-3 shrink-0 text-muted-foreground" />}
      {tag.icon}
      {label}
    </button>
  );
}

/* ── Master on/off switch for the chip row ───────────────────────────────── */
export function MasterSwitch({
  on,
  onToggle,
  config,
}: {
  on: boolean;
  onToggle: () => void;
  config: MasterSwitchConfig;
}) {
  const label = on ? config.label : (config.labelOff ?? config.label);
  const title = on ? config.title : (config.titleOff ?? config.title);
  return (
    <button
      type="button"
      aria-pressed={on}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onToggle}
      title={title}
      data-motion-pill=""
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium transition-colors',
        on
          ? 'border-primary/60 bg-primary/10 text-primary hover:bg-primary/20'
          : 'border-input bg-transparent text-muted-foreground hover:text-foreground',
      )}
    >
      {config.icon ?? <ListChecks className="size-3" />}
      {label} {on ? 'on' : 'off'}
    </button>
  );
}

/** Selected first, then tags auto-tag is currently highlighting from the text
 * (suggested but not yet accepted), each tier keeping its original order. Only
 * the scrollable list sorts this way; the chip row keeps the caller's order. */
function sortByPriority(
  tags: RichTag[],
  selected: Set<string>,
  highlighted: Set<string> | undefined,
): RichTag[] {
  const hi = highlighted ?? EMPTY_SET;
  return [
    ...tags.filter((t) => selected.has(t.id)),
    ...tags.filter((t) => !selected.has(t.id) && hi.has(t.id)),
    ...tags.filter((t) => !selected.has(t.id) && !hi.has(t.id)),
  ];
}

const EMPTY_SET: Set<string> = new Set();

/* ── Guideline toggle chips (with show-more + optional leading switch) ────── */
/**
 * The wrapping chip row. Chips always render in the order the caller passed
 * them: toggling one on, or auto-tag suggesting one, never moves it — so a
 * guideline child (`depth` > 0) stays under its parent and nothing shifts
 * under the pointer.
 *
 * Collapsed by `showMax`, the row shows the first `showMax` chips plus every
 * selected or suggested chip past the cut, still in the caller's order, so an
 * active guideline is never hidden behind "+N more"; the button counts only
 * the chips that remain hidden.
 */
export function TagChips({
  tags,
  selected,
  highlighted,
  onToggle,
  showMax,
  expanded,
  onExpand,
  leading,
  motion = true,
}: {
  tags: RichTag[];
  selected: Set<string>;
  /** Tags auto-tag is currently suggesting from the text — kept visible past
   * the `showMax` cut, but never moved. */
  highlighted?: Set<string>;
  onToggle: (id: string) => void;
  /** Collapse to this many chips (plus any selected/suggested ones past it). */
  showMax?: number;
  expanded: boolean;
  onExpand: () => void;
  /** Rendered as the first item of the row (e.g. the guidelines master switch). */
  leading?: ReactNode;
  /** Chips that appear (a guideline's revealed children) pop in, the others
   * glide aside for them. Default true. */
  motion?: boolean;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const shown = useMemo(() => {
    if (showMax == null || expanded) return tags;
    const hi = highlighted ?? EMPTY_SET;
    return tags.filter((t, i) => i < showMax || selected.has(t.id) || hi.has(t.id));
  }, [tags, selected, highlighted, showMax, expanded]);
  // A guideline's children come and go with it: they pop in, and shrink out.
  useFlipPop(rowRef, motion, { ghosts: true });
  if (tags.length === 0 && !leading) return null;
  const hidden = tags.length - shown.length;
  return (
    <div ref={rowRef} className="flex flex-wrap items-center gap-1.5">
      {leading}
      {shown.map((t) => (
        <TagChip key={t.id} tag={t} on={selected.has(t.id)} onToggle={onToggle} />
      ))}
      {hidden > 0 && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onExpand}
          data-motion-pill=""
          className="rounded-full border border-dashed border-input px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          +{hidden} more
        </button>
      )}
    </div>
  );
}

/* ── Scrollable tag list (e.g. project/service locations), capped in height ── */
const TAG_ROW_H = 30; // approx chip row height (px) incl. vertical gap

function tagMatches(tag: RichTag, q: string): boolean {
  return `${tag.label} ${tag.slug ?? tag.id} ${tag.description ?? ''}`.toLowerCase().includes(q);
}

export function TagScrollList({
  tags,
  selected,
  highlighted,
  onToggle,
  rows = 3,
  searchable = true,
}: {
  tags: RichTag[];
  selected: Set<string>;
  /** Tags auto-tag is currently suggesting from the text — floated just after
   * the selected ones. */
  highlighted?: Set<string>;
  onToggle: (id: string) => void;
  /** Visible height in chip rows before it scrolls. Default 3. */
  rows?: number;
  /** Show the leading search chip that opens the inline filter. Default true. */
  searchable?: boolean;
}) {
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');

  // Selected-first (then auto-tag-highlighted) ordering, snapshotted: re-sorted
  // when the tag set, the search state, or the live highlight set changes — NOT
  // when a chip of this list is tapped, so it doesn't teleport out from under
  // the pointer and shift its neighbours mid-interaction.
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const [order, setOrder] = useState<RichTag[]>(() => sortByPriority(tags, selected, highlighted));
  useEffect(() => {
    setOrder(sortByPriority(tags, selectedRef.current, highlighted));
  }, [tags, searching, highlighted]);
  // A selection that changes from elsewhere — a restored or cached draft
  // landing after mount, a `#` pick, the reset after a send — re-sorts too;
  // only the change our own tap caused is skipped.
  const ownTap = useRef(false);
  useEffect(() => {
    if (ownTap.current) {
      ownTap.current = false;
      return;
    }
    setOrder(sortByPriority(tags, selected, highlighted));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  if (tags.length === 0) return null;

  const q = query.trim().toLowerCase();
  const shown = q ? order.filter((t) => tagMatches(t, q)) : order;

  const closeSearch = () => {
    setSearching(false);
    setQuery('');
  };

  // Enabling a tag from the quick-search filter clears the typed query, so the
  // list falls back to full (selected-first) order and is ready for the next
  // pick instead of staying narrowed to what was just typed.
  const handleToggle = (id: string) => {
    ownTap.current = true;
    onToggle(id);
    if (query) setQuery('');
  };

  return (
    <div
      className="overflow-y-auto rounded-lg border border-input/60 bg-background/40 p-1.5"
      style={{ maxHeight: rows * TAG_ROW_H }}
    >
      <div className="flex flex-wrap gap-1.5">
        {searchable &&
          (searching ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-ring bg-background px-2 py-1">
              <Search className="size-3 shrink-0 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                placeholder="Filter tags…"
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    closeSearch();
                  }
                }}
                onBlur={() => {
                  if (!query.trim()) closeSearch();
                }}
                className="w-24 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
              />
              <button
                type="button"
                aria-label="Close tag search"
                onMouseDown={(e) => e.preventDefault()}
                onClick={closeSearch}
                className="inline-flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </span>
          ) : (
            <button
              type="button"
              aria-label="Search tags"
              title="Search tags"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setSearching(true)}
              className="inline-flex items-center rounded-full border border-input px-2 py-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              <Search className="size-3.5" />
            </button>
          ))}
        {shown.map((t) => (
          <TagChip key={t.id} tag={t} on={selected.has(t.id)} onToggle={handleToggle} />
        ))}
        {q && shown.length === 0 && (
          <span className="px-1 py-1 text-xs text-muted-foreground">No tags match “{query.trim()}”</span>
        )}
      </div>
    </div>
  );
}

/* ── Linked + matched tags behind one link pill ──────────────────────────── */
/**
 * The compact stand-in for {@link TagScrollList}: no list on screen, one row
 * holding a 🔍 link pill, the tags that are on (solid) and the ones auto-tag
 * matched in the text (dashed — a tap links them). The link pill opens what
 * the list's search chip opens: a filter, with the matching tags unfolding
 * under the row; Enter links the first, Escape or leaving folds it.
 *
 * Nothing in the row jumps: a tag keeps the place it took when it first
 * showed up (a matched tag tapped on stays where it is), newcomers are
 * appended and pop in, a leaver shrinks out and its neighbours glide into
 * the gap.
 */
export function TagLinkRow({
  tags,
  selected,
  highlighted,
  onToggle,
  rows = 3,
  label = 'Link tags',
  motion = true,
}: {
  tags: RichTag[];
  selected: Set<string>;
  /** Tags auto-tag matched in the text, in text order — shown dashed. */
  highlighted?: Set<string>;
  onToggle: (id: string) => void;
  /** Height (in chip rows) of the unfolded filter list before it scrolls. */
  rows?: number;
  /** The link pill's tooltip and accessible name (the pill itself is a 🔍). */
  label?: string;
  motion?: boolean;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');

  // Linked first (in the caller's order), then the matched ones — but only for
  // a newcomer: whatever is on screen keeps its place.
  const placed = useRef<string[]>([]);
  const items = useMemo(() => {
    const byId = new Map(tags.map((t) => [t.id, t]));
    const want = [
      ...tags.filter((t) => selected.has(t.id)).map((t) => t.id),
      ...[...(highlighted ?? EMPTY_SET)].filter((id) => !selected.has(id) && byId.has(id)),
    ];
    const wanted = new Set(want);
    const order = placed.current.filter((id) => wanted.has(id));
    for (const id of want) if (!order.includes(id)) order.push(id);
    placed.current = order;
    return order.map((id) => byId.get(id)!);
  }, [tags, selected, highlighted]);

  const { entries, exited } = usePresence(items, (t) => t.id, motion);
  useFlipPop(rowRef, motion);
  usePopOut(rowRef, exited, entries);

  const q = query.trim().toLowerCase();
  const matches = useMemo(() => (q ? tags.filter((t) => tagMatches(t, q)) : tags), [tags, q]);

  const close = () => {
    setSearching(false);
    setQuery('');
  };

  if (tags.length === 0) return null;

  return (
    <div>
      <div ref={rowRef} className="flex flex-wrap items-center gap-1.5">
        {searching ? (
          <span
            data-motion-pill=""
            className="inline-flex items-center gap-1 rounded-full border border-ring bg-background px-2 py-1"
          >
            <Search className="size-3 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              placeholder="Filter…"
              aria-label={label}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  e.stopPropagation();
                  close();
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  const first = matches.find((t) => !selected.has(t.id));
                  if (first) onToggle(first.id);
                  setQuery('');
                }
              }}
              onBlur={close}
              className="w-24 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
            />
            <button
              type="button"
              aria-label="Close"
              onMouseDown={(e) => e.preventDefault()}
              onClick={close}
              className="inline-flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          </span>
        ) : (
          <button
            type="button"
            aria-label={label}
            title={label}
            data-motion-pill=""
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setSearching(true)}
            className="inline-flex items-center rounded-full border border-input px-2 py-1 text-muted-foreground transition-colors hover:border-ring hover:text-foreground"
          >
            <Search className="size-3.5" />
          </button>
        )}
        {entries.map(({ key, item, leaving }) => (
          <TagChip
            key={key}
            tag={item}
            on={selected.has(key)}
            suggested={!selected.has(key)}
            leaving={leaving}
            onToggle={onToggle}
          />
        ))}
      </div>
      {searching && (
        <Unfold motion={motion}>
          <div
            className="mt-1.5 overflow-y-auto rounded-lg border border-input/60 bg-background/40 p-1.5"
            style={{ maxHeight: rows * TAG_ROW_H }}
          >
            <div className="flex flex-wrap gap-1.5">
              {matches.map((t) => (
                <TagChip key={t.id} tag={t} on={selected.has(t.id)} onToggle={onToggle} />
              ))}
              {q && matches.length === 0 && (
                <span className="px-1 py-1 text-xs text-muted-foreground">
                  Nothing matches “{query.trim()}”
                </span>
              )}
            </div>
          </div>
        </Unfold>
      )}
    </div>
  );
}

/** A box whose room glides open when it mounts (see `openRoom`). */
function Unfold({ motion, children }: { motion: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && motion && motionAllowed()) openRoom(el, []);
    // Mount only: it opens once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <div ref={ref}>{children}</div>;
}

/* ── Mention autocomplete menu ───────────────────────────────────────────── */
export function MentionMenu({
  matches,
  active,
  prefix,
  onHover,
  onPick,
}: {
  matches: RichTag[];
  active: number;
  prefix: string;
  onHover: (i: number) => void;
  onPick: (tag: RichTag) => void;
}) {
  return (
    <div className="mb-1.5 max-h-56 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg">
      {matches.map((t, i) => (
        <button
          key={t.id}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onMouseEnter={() => onHover(i)}
          onClick={() => onPick(t)}
          className={cn(
            'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
            i === active ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-accent/60',
          )}
        >
          {t.icon}
          <span className="font-medium">
            {prefix}
            {tagSlug(t)}
          </span>
          {t.description && (
            <span className="ml-auto truncate text-xs text-muted-foreground">{t.description}</span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ── Reverse (Ctrl+R) search bar ─────────────────────────────────────────── */
export function ReverseSearchBar({
  query,
  match,
  onQueryChange,
  onNext,
  onAccept,
  onClose,
}: {
  query: string;
  match: string | null;
  onQueryChange: (q: string) => void;
  onNext: () => void;
  onAccept: () => void;
  onClose: () => void;
}) {
  return (
    <div className="mb-1.5 flex items-center gap-2 rounded-lg border border-border bg-popover px-2.5 py-1.5 text-sm shadow-lg">
      <span className="shrink-0 font-mono text-xs text-muted-foreground">(reverse-i-search)</span>
      <input
        autoFocus
        value={query}
        placeholder="type to search history…"
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onAccept();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
          } else if ((e.ctrlKey && e.key.toLowerCase() === 'r') || e.key === 'ArrowUp') {
            e.preventDefault();
            onNext();
          }
        }}
        className="w-28 shrink-0 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
      />
      <span className="min-w-0 flex-1 truncate text-muted-foreground">{match ?? 'no match'}</span>
      <button
        type="button"
        aria-label="Close search"
        onClick={onClose}
        className="inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

/* ── Mobile history sheet ────────────────────────────────────────────────── */
export function HistorySheet({
  entries,
  onPick,
  onClose,
}: {
  entries: string[];
  onPick: (value: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Newest first for a history list.
  const rows = [...entries].reverse();
  return (
    <div className="fixed inset-0 z-[120] flex flex-col justify-end bg-black/40" onClick={onClose}>
      <div
        className="max-h-[70vh] rounded-t-2xl border-t border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
            <History className="size-4" /> History
          </span>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="inline-flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        {rows.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">No history yet</div>
        ) : (
          <VirtualList
            items={rows}
            className="max-h-[calc(70vh-3.25rem)] p-2"
            estimateSize={52}
            getItemKey={(_, i) => i}
            renderItem={(value) => (
              <div className="px-1 pb-1.5">
                <button
                  type="button"
                  onClick={() => onPick(value)}
                  className="flex w-full items-start gap-2 rounded-lg border border-transparent px-3 py-2 text-left text-sm text-foreground transition-colors hover:border-border hover:bg-accent/50"
                >
                  <Undo2 className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <span className="line-clamp-2 min-w-0 flex-1">{value}</span>
                </button>
              </div>
            )}
          />
        )}
      </div>
    </div>
  );
}

/* ── Submit-error notification ───────────────────────────────────────────── */
/** Shown when an async `onSubmit` rejects. Dismiss with ✕ or a horizontal swipe. */
export function SubmitErrorBanner({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  const swipe = useSwipeDismiss(onDismiss);
  return (
    <div
      {...swipe}
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
    >
      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
      <span className="min-w-0 flex-1 break-words">{message}</span>
      <button
        type="button"
        aria-label="Dismiss error"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
        className="-m-1 rounded p-1 transition-colors hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

/* ── Un-send overlay ─────────────────────────────────────────────────────── */
/**
 * The sweep's start: the ease-out it has always had — most of the way across
 * in its first second, so the send reads as already on its way.
 */
const UNSEND_EASING: CurveEasing = [0.25, 1, 0.5, 1];
/** The finish: an exponential ease-in (expo-in), the snap into the send. */
const UNSEND_FINISH_EASING: CurveEasing = [0.7, 0, 0.84, 0];
/** Where the sweep holds — near full, so it reads "almost gone"… */
export const UNSEND_PLATEAU = 0.98;
/** …reached this far into the window (the fast start's end)… */
export const UNSEND_PLATEAU_AT = 0.45;
/** …and left this far in, for the exponential finish into the send. */
export const UNSEND_FINISH_AT = 0.95;

/**
 * The sweep's default progression over the window: the fast ease-out start up
 * to {@link UNSEND_PLATEAU} by {@link UNSEND_PLATEAU_AT}, a plateau there,
 * then an exponential finish to full from {@link UNSEND_FINISH_AT} — exactly
 * when the send fires. The plateau leaves the end of the window as room to
 * take the send back; the finish says it is going *now*. Any
 * {@link AnimationCurve} can replace it (`RichInput`'s `unsendCurve`, edited
 * with `CurveEditor`).
 */
export const DEFAULT_UNSEND_CURVE: AnimationCurve = {
  points: [
    { x: 0, y: 0 },
    { x: UNSEND_PLATEAU_AT, y: UNSEND_PLATEAU },
    { x: UNSEND_FINISH_AT, y: UNSEND_PLATEAU },
    { x: 1, y: 1 },
  ],
  easings: [UNSEND_EASING, LINEAR_EASING, UNSEND_FINISH_EASING],
};

/**
 * The sweep's progression, 0 → 1 over the window's fraction `f` (0 → 1), on
 * `curve` ({@link DEFAULT_UNSEND_CURVE} by default) — the JS twin of the Web
 * Animations keyframes, used where those are missing (and in tests).
 */
export function unsendProgress(f: number, curve: AnimationCurve = DEFAULT_UNSEND_CURVE): number {
  return evalCurve(curve, f);
}

const sweepAt = (p: number) => `translateX(${(p - 1) * 100}%)`;

/**
 * The lock laid over the composer while a send waits out its un-send window:
 * the composer underneath keeps showing what went out, a primary wash sweeps
 * across it left → right as the window runs down (on `curve` — by default
 * fast at first, holding near full, then snapping into the send), and a tap
 * anywhere on it takes the send back.
 *
 * Driven by the window's start and length rather than a ticking prop, so a
 * composer that remounts mid-window (a caller-held send outliving its
 * composer) resumes the sweep where it was. The sweep runs on the Web
 * Animations API — no keyframes to ship in a stylesheet the consumer may not
 * import. Pass `progress` instead of `startedAt` for a still frame (a settings
 * preview driving it from a `CurveEditor`).
 *
 * @summary The composer's "Sending… tap to cancel" lock with its progress
 * sweep — for previewing an un-send curve outside a live RichInput.
 */
export function UnsendOverlay({
  startedAt = 0,
  durationMs,
  onCancel,
  curve = DEFAULT_UNSEND_CURVE,
  progress,
}: {
  /** When the window opened (`Date.now()` ms). Ignored with `progress`. */
  startedAt?: number;
  /** The window's length in ms. */
  durationMs: number;
  /** A tap on it: take the send back. */
  onCancel?: () => void;
  /** The sweep's timing. @default DEFAULT_UNSEND_CURVE */
  curve?: AnimationCurve;
  /**
   * A still frame at this time fraction (0 → 1) of the window, for previews:
   * no animation, no clock — the caller drives it.
   */
  progress?: number;
}) {
  const sweepRef = useRef<HTMLDivElement>(null);
  const still = progress !== undefined;
  const remaining = () => Math.max(0, startedAt + durationMs - Date.now());
  const [left, setLeft] = useState(remaining);
  // The keyframes restart only when the curve's numbers change, not on every
  // new object with the same ones.
  const curveKey = JSON.stringify(curve);

  useEffect(() => {
    if (still) return;
    setLeft(remaining());
    const id = setInterval(() => setLeft(remaining()), 200);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startedAt, durationMs, still]);

  useLayoutEffect(() => {
    const el = sweepRef.current;
    if (!el || durationMs <= 0 || still) return;
    const elapsed = Math.min(durationMs, Math.max(0, Date.now() - startedAt));
    if (typeof el.animate !== 'function') {
      // No Web Animations (jsdom): a static snapshot of the same curve.
      el.style.transform = sweepAt(unsendProgress(elapsed / durationMs, curve));
      return;
    }
    const anim = el.animate(
      curveKeyframes(curve, (p) => ({ transform: sweepAt(p) })),
      { duration: durationMs, easing: 'linear', fill: 'forwards' },
    );
    anim.currentTime = elapsed;
    return () => anim.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startedAt, durationMs, curveKey, still]);

  const seconds = Math.ceil((still ? (1 - Math.min(1, Math.max(0, progress))) * durationMs : left) / 1000);
  return (
    <button
      type="button"
      data-unsend-overlay=""
      aria-label={`Sending in ${seconds}s — tap to cancel`}
      // Keep the textarea's focus (and the phone keyboard) through the tap.
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => {
        e.stopPropagation();
        onCancel?.();
      }}
      className="absolute inset-0 z-30 cursor-pointer overflow-hidden rounded-2xl bg-card/30 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div
        ref={sweepRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 border-r-2 border-primary/70 bg-primary/15"
        style={{ transform: still ? sweepAt(unsendProgress(progress, curve)) : sweepAt(0) }}
      />
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center p-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-sm">
          <Undo2 className="size-3.5 text-primary" />
          Sending… tap to cancel ·
          <span className="font-mono tabular-nums text-muted-foreground">{seconds}s</span>
        </span>
      </span>
    </button>
  );
}
