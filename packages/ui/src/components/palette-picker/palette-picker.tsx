import * as React from 'react';
import { createPortal } from 'react-dom';
import { Plus, Shuffle, Trash2, X } from 'lucide-react';

import { cn } from '../../lib/utils';
import { useIsMobile } from '../../hooks/use-media-query';
import { useEscape, useOutsideClick, useScrollLock } from '../../hooks/use-overlay';
import {
  generatePalette,
  hexToHsl,
  isValidHex,
  normalizeHex,
  randomColor,
  readableTextColor,
  type Harmony,
} from '../../lib/color';
import type { Palette } from './color-theme';

export interface PalettePickerProps {
  /** The current palette (3–6 colours by convention; enforced by min/max). */
  value: Palette;
  onChange: (palette: Palette) => void;
  /** Fewest swatches allowed. Default 3. */
  min?: number;
  /** Most swatches allowed. Default 6. */
  max?: number;
  /** Harmony used by the shuffle button. `auto` rerolls the harmony too. */
  harmony?: Harmony;
  /** Trigger label for screen readers / the closed state. */
  label?: string;
  className?: string;
  /** Render the panel inline (always open) instead of as a dropdown/overlay —
   *  for embedding inside your own popover. */
  inline?: boolean;
  disabled?: boolean;
}

/** A monotonically increasing seed so successive shuffles differ without
 *  `Math.random` — starts from the palette itself so first shuffle is stable. */
function seedFrom(palette: Palette, salt: number): number {
  let h = 2166136261 ^ salt;
  for (const c of palette.join(',')) {
    h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  }
  return h >>> 0;
}

/**
 * Pick and build a colour palette.
 *
 * The closed trigger shows the palette as vertical stripes. Opening it reveals
 * an editor: each swatch is a native colour picker plus a hex field and a
 * remove button, an **＋** adds a colour-theory-pleasing next swatch, and
 * **Shuffle** regenerates the whole palette from a harmony. On desktop the
 * editor is a dropdown anchored above the trigger; on phones it's an overlay
 * pinned to the bottom of the screen.
 *
 * @summary Vertical-stripe colour-palette editor (dropdown on desktop, bottom sheet
 * on mobile) with dependency-free harmony generation, plus
 * `ColorThemeProvider`/`paletteToVars` to push a palette into CSS variables.
 */
export function PalettePicker({
  value,
  onChange,
  min = 3,
  max = 6,
  harmony = 'auto',
  label = 'Colour palette',
  className,
  inline = false,
  disabled = false,
}: PalettePickerProps) {
  const [open, setOpen] = React.useState(false);
  const isMobile = useIsMobile();
  const salt = React.useRef(0);

  const close = React.useCallback(() => setOpen(false), []);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  const setColor = (i: number, hex: string) => {
    const next = value.slice();
    next[i] = hex;
    onChange(next);
  };

  const addColor = () => {
    if (value.length >= max) return;
    salt.current += 1;
    const near = value[value.length - 1];
    onChange([...value, randomColor(seedFrom(value, salt.current), near)]);
  };

  const removeColor = (i: number) => {
    if (value.length <= min) return;
    onChange(value.filter((_, j) => j !== i));
  };

  const shuffle = () => {
    salt.current += 1;
    onChange(
      generatePalette({
        count: value.length,
        harmony,
        seed: seedFrom(value, salt.current),
      }),
    );
  };

  const editor = (
    <PaletteEditor
      value={value}
      min={min}
      max={max}
      onSetColor={setColor}
      onAddColor={addColor}
      onRemoveColor={removeColor}
      onShuffle={shuffle}
    />
  );

  if (inline) {
    return <div className={cn('ds-palette-editor-inline', className)}>{editor}</div>;
  }

  return (
    <div className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'ds-palette-trigger flex h-10 w-full items-center gap-3 rounded-md border border-input bg-background px-2 text-left text-sm transition-colors hover:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        <PaletteStripes palette={value} className="h-6 w-24 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-muted-foreground">{label}</span>
        <span className="shrink-0 pr-1 text-xs tabular-nums text-muted-foreground">
          {value.length}
        </span>
      </button>

      {open && !isMobile && (
        <DesktopDropdown onClose={close} triggerRef={triggerRef}>
          {editor}
        </DesktopDropdown>
      )}
      {open && isMobile && (
        <MobileSheet onClose={close} title={label}>
          {editor}
        </MobileSheet>
      )}
    </div>
  );
}

/** The palette rendered as adjacent vertical stripes. */
export function PaletteStripes({
  palette,
  className,
}: {
  palette: Palette;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'ds-palette-stripes inline-flex overflow-hidden rounded border border-border/60',
        className,
      )}
      aria-hidden
    >
      {(palette.length ? palette : ['#e7e5e4']).map((c, i) => (
        <span key={i} className="h-full flex-1" style={{ backgroundColor: c }} />
      ))}
    </span>
  );
}

function PaletteEditor({
  value,
  min,
  max,
  onSetColor,
  onAddColor,
  onRemoveColor,
  onShuffle,
}: {
  value: Palette;
  min: number;
  max: number;
  onSetColor: (i: number, hex: string) => void;
  onAddColor: () => void;
  onRemoveColor: (i: number) => void;
  onShuffle: () => void;
}) {
  return (
    <div className="ds-palette-editor flex w-full flex-col gap-3">
      {/* Big live preview strip */}
      <PaletteStripes palette={value} className="h-14 w-full" />

      <div className="flex flex-col gap-1.5">
        {value.map((hex, i) => (
          <ColorRow
            key={i}
            index={i}
            hex={hex}
            canRemove={value.length > min}
            onChange={(h) => onSetColor(i, h)}
            onRemove={() => onRemoveColor(i)}
          />
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onAddColor}
          disabled={value.length >= max}
          aria-label="Add colour"
          className="ds-palette-btn flex flex-1 items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
        >
          <Plus className="size-4" /> Add
        </button>
        <button
          type="button"
          onClick={onShuffle}
          aria-label="Random palette"
          title="Generate a random pleasing palette"
          className="ds-palette-btn flex flex-1 items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
        >
          <Shuffle className="size-4" /> Random
        </button>
      </div>
      <p className="text-center text-[11px] text-muted-foreground">
        {value.length} of {max} · {min}–{max} colours
      </p>
    </div>
  );
}

/** One editable swatch: colour picker + hex field + delete. */
function ColorRow({
  index,
  hex,
  canRemove,
  onChange,
  onRemove,
}: {
  index: number;
  hex: string;
  canRemove: boolean;
  onChange: (hex: string) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = React.useState(hex);
  React.useEffect(() => setDraft(hex), [hex]);

  const commitDraft = (raw: string) => {
    if (isValidHex(raw)) onChange(normalizeHex(raw));
    else setDraft(hex);
  };

  const textColor = readableTextColor(hex);
  const roll = () => onChange(randomColor(hexToHsl(hex).h * 977 + index * 31 + draft.length));

  return (
    <div className="ds-palette-row flex items-center gap-2">
      {/* Native colour picker wrapped so the swatch itself is the control. */}
      <label
        className="relative size-9 shrink-0 cursor-pointer overflow-hidden rounded-md border border-border"
        style={{ backgroundColor: hex }}
      >
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
          aria-label={`Colour ${index + 1}`}
        />
      </label>

      <div className="relative flex flex-1 items-center">
        <span className="pointer-events-none absolute left-2 text-xs text-muted-foreground">#</span>
        <input
          type="text"
          value={draft.replace(/^#/, '')}
          spellCheck={false}
          onChange={(e) => setDraft('#' + e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6))}
          onBlur={() => commitDraft(draft)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          className="h-9 w-full rounded-md border border-input bg-background pl-5 pr-2 font-mono text-xs uppercase tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Hex for colour ${index + 1}`}
        />
      </div>

      <button
        type="button"
        onClick={roll}
        aria-label={`Randomise colour ${index + 1}`}
        title="Randomise this colour"
        className="ds-palette-icon flex size-9 shrink-0 items-center justify-center rounded-md border border-input text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Shuffle className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={onRemove}
        disabled={!canRemove}
        title="Remove colour"
        style={canRemove ? undefined : { color: textColor }}
        className="ds-palette-icon flex size-9 shrink-0 items-center justify-center rounded-md border border-input text-muted-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground disabled:pointer-events-none disabled:opacity-30"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}

/** Desktop: a dropdown panel anchored above the trigger (flips below if the
 *  trigger sits near the top of the viewport). */
function DesktopDropdown({
  children,
  onClose,
  triggerRef,
}: {
  children: React.ReactNode;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const ref = useOutsideClick<HTMLDivElement>(onClose);
  useEscape(onClose);

  // Anchor above unless there isn't room, then flip below.
  const [placeBelow, setPlaceBelow] = React.useState(false);
  React.useLayoutEffect(() => {
    const t = triggerRef.current?.getBoundingClientRect();
    if (t && t.top < 380) setPlaceBelow(true);
  }, [triggerRef]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Palette editor"
      className={cn(
        'ds-palette-panel absolute left-0 z-50 w-72 rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-2xl',
        placeBelow ? 'top-full mt-2' : 'bottom-full mb-2',
      )}
    >
      {children}
    </div>
  );
}

/** Mobile: an overlay sheet stuck to the bottom of the screen. */
function MobileSheet({
  children,
  onClose,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
}) {
  useScrollLock(true);
  useEscape(onClose);
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="ds-palette-scrim fixed inset-0 z-[95] flex items-end bg-black/50 backdrop-blur-sm"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-label="Palette editor"
        className="ds-palette-sheet max-h-[85vh] w-full overflow-y-auto rounded-t-2xl border-t border-border bg-popover px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 text-popover-foreground shadow-2xl"
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium">{title}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
