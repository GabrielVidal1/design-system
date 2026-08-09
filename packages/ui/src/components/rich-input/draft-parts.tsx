import { useRef, useState, type MouseEvent } from 'react';
import { Loader2, NotebookPen, Save, SendHorizontal, Trash2, X } from 'lucide-react';

import { cn } from '../../lib/utils';
import { useLongPress } from '../../hooks/use-long-press';
import { useEscape, useOutsideClick } from '../../hooks/use-overlay';
import { FuzzyList } from '../fuzzy-list';
import { RelativeTime } from '../relative-time';
import type { RichDraft } from './types';

/* ── Send button with a long-press "save as draft" menu ──────────────────── */
export function SendDraftButton({
  canSend,
  sending = false,
  submit,
  onSaveDraft,
  open: openProp,
  onOpenChange,
}: {
  canSend: boolean;
  /** An async `onSubmit` is in flight — spinner instead of the send icon. */
  sending?: boolean;
  submit: () => void;
  /** Absent ⇒ drafts are disabled: the button is a plain send button. */
  onSaveDraft?: () => void;
  /**
   * Controlled menu (the reorderable toolbar's first-stage hold owns the
   * gesture): `open` renders the menu, `onOpenChange` reports closes and the
   * right-click open. The internal long-press is off in this mode.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const controlled = onOpenChange !== undefined;
  const [openState, setOpen] = useState(false);
  const open = controlled ? (openProp ?? false) : openState;
  const close = () => (controlled ? onOpenChange(false) : setOpen(false));
  const wrapRef = useOutsideClick<HTMLDivElement>(close, open);
  useEscape(close, open);

  const lp = useLongPress(() => canSend && onSaveDraft && setOpen(true), {
    onClick: () => {
      close();
      submit();
    },
  });

  // Controlled mode: a plain click sends; right-click still opens the menu.
  const controlledHandlers = {
    onClick: submit,
    onContextMenu: (e: MouseEvent) => {
      if (!canSend || !onSaveDraft) return;
      e.preventDefault();
      onOpenChange?.(true);
    },
  };

  return (
    <div ref={wrapRef} className="relative inline-flex">
      <button
        {...(controlled ? controlledHandlers : onSaveDraft ? lp : { onClick: submit })}
        type="button"
        aria-label="Send"
        title={onSaveDraft ? 'Send · hold to save as draft' : 'Send'}
        disabled={!canSend}
        className={cn(
          'inline-flex size-8 items-center justify-center rounded-lg transition-colors',
          canSend
            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
            : 'bg-muted text-muted-foreground',
        )}
      >
        {sending ? <Loader2 className="size-4 animate-spin" /> : <SendHorizontal className="size-4" />}
      </button>

      {open && (
        <div className="absolute bottom-full right-0 z-50 mb-2 w-44 overflow-hidden rounded-xl border border-border bg-popover py-1 shadow-xl">
          <button
            type="button"
            onClick={() => {
              close();
              submit();
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-medium text-foreground transition-colors hover:bg-accent"
          >
            <SendHorizontal className="size-3.5 shrink-0 text-muted-foreground" />
            Send
          </button>
          <button
            type="button"
            onClick={() => {
              close();
              onSaveDraft?.();
            }}
            className="flex w-full items-center gap-2 border-t border-border px-3 py-1.5 text-left text-xs font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Save className="size-3.5 shrink-0 text-primary" />
            Save as draft
          </button>
        </div>
      )}
    </div>
  );
}

/* ── The drafts shelf: icon button + fuzzy-search dropdown ───────────────── */
export function DraftsMenu({
  drafts,
  onPick,
  onDelete,
}: {
  drafts: RichDraft[];
  onPick: (draft: RichDraft) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const wrapRef = useOutsideClick<HTMLDivElement>(close, open);
  useEscape(close, open);
  // Focus the search box only for pointer-fine devices — on touch, autofocus
  // pops the keyboard over the list.
  const fine = useRef(
    typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches,
  );

  if (drafts.length === 0) return null;

  return (
    <div ref={wrapRef} className="relative inline-flex">
      <button
        type="button"
        aria-label={`Drafts (${drafts.length})`}
        title={`Drafts (${drafts.length})`}
        aria-expanded={open}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'relative inline-flex size-8 items-center justify-center rounded-lg border transition-colors',
          open
            ? 'border-input bg-accent text-foreground'
            : 'border-transparent text-muted-foreground hover:border-input hover:text-foreground',
        )}
      >
        <NotebookPen className="size-4" />
        <span className="absolute -right-1 -top-1 inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-0.5 text-[9px] font-semibold leading-none text-primary-foreground">
          {drafts.length}
        </span>
      </button>

      {open && (
        <div className="absolute bottom-full right-0 z-50 mb-2 flex max-h-80 w-[19rem] max-w-[85vw] flex-col rounded-xl border border-border bg-popover p-2 shadow-xl">
          <FuzzyList
            items={drafts}
            keys={['text']}
            getItemKey={(d) => d.id}
            autoFocus={fine.current}
            showCount={false}
            debounce={100}
            estimateSize={62}
            placeholder="Search drafts…"
            emptyState="No drafts match."
            listClassName="max-h-60"
            onSelect={(d) => {
              close();
              onPick(d);
            }}
            renderItem={({ item, active, highlight }) => (
              // Row activation (click / Enter) is FuzzyList's own — only the
              // delete button needs its own handler (and a stopPropagation).
              <div
                className={cn(
                  'group flex cursor-pointer items-start gap-2 rounded-lg border border-transparent px-2 py-1.5 transition-colors',
                  active && 'border-border bg-accent/60',
                )}
              >
                <div className="min-w-0 flex-1 text-left">
                  <span className="line-clamp-2 text-xs leading-5 text-foreground">
                    {item.text.trim() ? highlight('text') : <em>(attachments only)</em>}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <RelativeTime date={item.savedAt} />
                    {item.tags.length > 0 && <span>{item.tags.length} tag{item.tags.length === 1 ? '' : 's'}</span>}
                    {item.files.length > 0 && <span>{item.files.length} file{item.files.length === 1 ? '' : 's'}</span>}
                  </span>
                </div>
                <button
                  type="button"
                  aria-label="Delete draft"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(item.id);
                  }}
                  className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-all hover:bg-muted hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            )}
          />
          <button
            type="button"
            aria-label="Close drafts"
            onClick={close}
            className="absolute -right-1.5 -top-1.5 inline-flex size-5 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:text-foreground md:hidden"
          >
            <X className="size-3" />
          </button>
        </div>
      )}
    </div>
  );
}
