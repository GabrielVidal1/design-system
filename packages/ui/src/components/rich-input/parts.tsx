import { useEffect } from 'react';
import { File as FileIcon, History, Undo2, X } from 'lucide-react';

import { cn } from '../../lib/utils';
import { VirtualList } from '../virtual-list';
import { tagSlug } from './use-mention';
import type { GuidelineTag, RichFile } from './types';

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

/* ── Guideline toggle chips (with show-more) ─────────────────────────────── */
export function TagChips({
  tags,
  selected,
  onToggle,
  showMax,
  expanded,
  onExpand,
}: {
  tags: GuidelineTag[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  showMax?: number;
  expanded: boolean;
  onExpand: () => void;
}) {
  if (tags.length === 0) return null;
  const hidden = showMax != null && !expanded ? Math.max(0, tags.length - showMax) : 0;
  const shown = hidden > 0 ? tags.slice(0, showMax) : tags;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {shown.map((t) => {
        const on = selected.has(t.id);
        const label = on ? t.label : (t.labelOff ?? t.label);
        return (
          <button
            key={t.id}
            type="button"
            aria-pressed={on}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onToggle(t.id)}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors',
              on
                ? 'border-primary/40 bg-primary/10 text-foreground'
                : 'border-input text-muted-foreground hover:text-foreground',
            )}
          >
            {t.icon}
            {label}
          </button>
        );
      })}
      {hidden > 0 && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onExpand}
          className="rounded-full border border-dashed border-input px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          +{hidden} more
        </button>
      )}
    </div>
  );
}

/* ── Mention autocomplete menu ───────────────────────────────────────────── */
export function MentionMenu({
  matches,
  active,
  prefix,
  onHover,
  onPick,
}: {
  matches: GuidelineTag[];
  active: number;
  prefix: string;
  onHover: (i: number) => void;
  onPick: (tag: GuidelineTag) => void;
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

/* ── Un-send banner ──────────────────────────────────────────────────────── */
export function UnsendBanner({
  countdown,
  onUndo,
}: {
  countdown: number;
  onUndo: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onUndo}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-primary/15"
    >
      <Undo2 className="size-4" />
      Sent — tap to un-send
      <span className="font-mono tabular-nums text-muted-foreground">{countdown}s</span>
    </button>
  );
}
