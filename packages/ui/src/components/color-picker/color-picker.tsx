import * as React from 'react';
import { createPortal } from 'react-dom';
import { Pipette, X } from 'lucide-react';

import { cn } from '../../lib/utils';
import { useIsMobile } from '../../hooks/use-media-query';
import { useEscape, useOutsideClick, useScrollLock } from '../../hooks/use-overlay';
import { hexToRgb, hsvToRgb, rgbToHex, rgbToHsv, type HSV } from '../../lib/color';

export interface ColorPickerProps {
  /** The current colour — `#rrggbb`, or `#rrggbbaa` when `alpha` is on. */
  value: string;
  onChange: (hex: string) => void;
  /** Show an opacity slider and emit `#rrggbbaa`. @default false */
  alpha?: boolean;
  /** Preset swatch row under the sliders (e.g. the document's palette). */
  swatches?: string[];
  /** Trigger label (and the sheet title on phones). */
  label?: string;
  /** Render the panel inline (always open) instead of behind a trigger —
   *  for embedding in an inspector or your own popover. */
  inline?: boolean;
  disabled?: boolean;
  className?: string;
}

/** `{h,s,v,a}` — alpha 0–100. */
interface Hsva extends HSV {
  a: number;
}

function parse(value: string, alphaOn: boolean): Hsva {
  const { r, g, b } = hexToRgb(value);
  const hsv = rgbToHsv(r, g, b);
  let a = 100;
  const m = value.trim().match(/^#[0-9a-fA-F]{8}$/);
  if (alphaOn && m) a = (parseInt(value.trim().slice(7, 9), 16) / 255) * 100;
  return { ...hsv, a };
}

function serialize({ h, s, v, a }: Hsva, alphaOn: boolean): string {
  const { r, g, b } = hsvToRgb(h, s, v);
  const hex = rgbToHex(r, g, b);
  if (!alphaOn) return hex;
  const aa = Math.round((Math.min(100, Math.max(0, a)) / 100) * 255)
    .toString(16)
    .padStart(2, '0');
  return hex + aa;
}

/** CSS checkerboard, for under the alpha slider and translucent swatches. */
const CHECKER: React.CSSProperties = {
  backgroundImage:
    'linear-gradient(45deg, rgba(120,120,120,.35) 25%, transparent 25%, transparent 75%, rgba(120,120,120,.35) 75%), linear-gradient(45deg, rgba(120,120,120,.35) 25%, transparent 25%, transparent 75%, rgba(120,120,120,.35) 75%)',
  backgroundSize: '10px 10px',
  backgroundPosition: '0 0, 5px 5px',
};

/**
 * A real colour picker — not the native `<input type="color">` swatch. A
 * pointer-captured saturation/value square, a hue slider, an optional alpha
 * slider, a hex field, an eyedropper (where the browser has one) and preset
 * swatches. Hue survives round-trips through black/white/grey (the picker
 * keeps its own HSV state and only re-parses external values). Behind a
 * trigger it opens as a dropdown on desktop and a bottom sheet on phones;
 * `inline` embeds the panel directly — the shape an `InspectorPanel` row wants.
 *
 * @summary Full HSV colour picker (saturation square, hue + optional alpha
 * sliders, hex field, eyedropper, swatches) — dropdown on desktop, bottom
 * sheet on mobile, or inline.
 */
export function ColorPicker({
  value,
  onChange,
  alpha = false,
  swatches,
  label = 'Colour',
  inline = false,
  disabled = false,
  className,
}: ColorPickerProps) {
  const [open, setOpen] = React.useState(false);
  const isMobile = useIsMobile();
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const close = React.useCallback(() => setOpen(false), []);

  // Own HSV state so hue/saturation aren't lost when the hex collapses them
  // (black, white, greys). External `value` wins only when it isn't the hex
  // we last emitted.
  const [hsva, setHsva] = React.useState<Hsva>(() => parse(value, alpha));
  const emitted = React.useRef(value);
  React.useEffect(() => {
    if (value.toLowerCase() !== emitted.current.toLowerCase()) {
      setHsva(parse(value, alpha));
      emitted.current = value;
    }
  }, [value, alpha]);

  const set = (patch: Partial<Hsva>) => {
    const next = { ...hsva, ...patch };
    setHsva(next);
    const hex = serialize(next, alpha);
    emitted.current = hex;
    onChange(hex);
  };

  const panel = (
    <ColorPanel
      hsva={hsva}
      alpha={alpha}
      swatches={swatches}
      onSet={set}
      onPick={(hex) => {
        setHsva(parse(alpha && hex.length === 7 ? hex + 'ff' : hex, alpha));
        emitted.current = hex;
        onChange(hex);
      }}
      currentHex={serialize(hsva, alpha)}
    />
  );

  if (inline) {
    return <div className={cn('ds-color-inline w-full', className)}>{panel}</div>;
  }

  const hex = serialize(hsva, alpha);
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
          'flex h-10 w-full items-center gap-3 rounded-md border border-input bg-background px-2 text-left text-sm transition-colors hover:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        <span
          className="relative size-6 shrink-0 overflow-hidden rounded border border-border/60"
          style={CHECKER}
          aria-hidden
        >
          <span className="absolute inset-0" style={{ backgroundColor: hex }} />
        </span>
        <span className="min-w-0 flex-1 truncate text-muted-foreground">{label}</span>
        <span className="shrink-0 pr-1 font-mono text-xs uppercase tabular-nums text-muted-foreground">
          {hex}
        </span>
      </button>

      {open && !isMobile && (
        <DesktopDropdown onClose={close} triggerRef={triggerRef}>
          {panel}
        </DesktopDropdown>
      )}
      {open && isMobile && (
        <MobileSheet onClose={close} title={label}>
          {panel}
        </MobileSheet>
      )}
    </div>
  );
}

function ColorPanel({
  hsva,
  alpha,
  swatches,
  onSet,
  onPick,
  currentHex,
}: {
  hsva: Hsva;
  alpha: boolean;
  swatches?: string[];
  onSet: (patch: Partial<Hsva>) => void;
  onPick: (hex: string) => void;
  currentHex: string;
}) {
  const opaque = serialize({ ...hsva, a: 100 }, false);
  const hueColor = serialize({ h: hsva.h, s: 100, v: 100, a: 100 }, false);

  // EyeDropper is Chromium-only for now; the button simply hides elsewhere.
  const dropper = typeof window !== 'undefined' && 'EyeDropper' in window;
  const pickFromScreen = async () => {
    try {
      const ctor = (window as unknown as { EyeDropper: new () => { open(): Promise<{ sRGBHex: string }> } })
        .EyeDropper;
      const { sRGBHex } = await new ctor().open();
      onPick(sRGBHex.toLowerCase());
    } catch {
      /* user dismissed the eyedropper */
    }
  };

  return (
    <div className="flex w-full flex-col gap-3">
      <SVArea hsva={hsva} hueColor={hueColor} onSet={onSet} />

      <ChannelSlider
        label="Hue"
        value={hsva.h}
        max={360}
        onChange={(h) => onSet({ h })}
        trackStyle={{
          background:
            'linear-gradient(to right, #f00, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00)',
        }}
        thumbColor={hueColor}
      />

      {alpha && (
        <ChannelSlider
          label="Opacity"
          value={hsva.a}
          max={100}
          onChange={(a) => onSet({ a })}
          checker
          trackStyle={{
            background: `linear-gradient(to right, transparent, ${opaque})`,
          }}
          thumbColor={opaque}
        />
      )}

      <div className="flex items-center gap-2">
        <HexField hex={currentHex} alpha={alpha} onPick={onPick} />
        {dropper && (
          <button
            type="button"
            onClick={pickFromScreen}
            aria-label="Pick colour from screen"
            title="Pick colour from screen"
            className="flex size-9 shrink-0 items-center justify-center rounded-md border border-input text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Pipette className="size-3.5" />
          </button>
        )}
      </div>

      {swatches && swatches.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="listbox" aria-label="Swatches">
          {swatches.map((c, i) => {
            const selected = c.toLowerCase() === currentHex.toLowerCase();
            return (
              <button
                key={`${c}-${i}`}
                type="button"
                role="option"
                aria-selected={selected}
                aria-label={c}
                title={c}
                onClick={() => onPick(c)}
                className={cn(
                  'relative size-7 overflow-hidden rounded-md border border-border/60 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selected && 'ring-2 ring-ring ring-offset-1 ring-offset-popover',
                )}
                style={CHECKER}
              >
                <span className="absolute inset-0" style={{ backgroundColor: c }} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** The saturation/value square: x = saturation, y = value (top = 100). */
function SVArea({
  hsva,
  hueColor,
  onSet,
}: {
  hsva: Hsva;
  hueColor: string;
  onSet: (patch: Partial<Hsva>) => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const dragging = React.useRef(false);

  const fromPointer = (e: { clientX: number; clientY: number }) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    const s = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)) * 100;
    const v = (1 - Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))) * 100;
    onSet({ s, v });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 2;
    const moves: Record<string, Partial<Hsva>> = {
      ArrowRight: { s: Math.min(100, hsva.s + step) },
      ArrowLeft: { s: Math.max(0, hsva.s - step) },
      ArrowUp: { v: Math.min(100, hsva.v + step) },
      ArrowDown: { v: Math.max(0, hsva.v - step) },
    };
    const patch = moves[e.key];
    if (!patch) return;
    e.preventDefault();
    onSet(patch);
  };

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label="Saturation and brightness"
      aria-valuetext={`saturation ${Math.round(hsva.s)}%, brightness ${Math.round(hsva.v)}%`}
      aria-valuenow={Math.round(hsva.v)}
      aria-valuemin={0}
      aria-valuemax={100}
      onKeyDown={onKeyDown}
      onPointerDown={(e) => {
        e.preventDefault();
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        e.currentTarget.focus({ preventScroll: true });
        fromPointer(e);
      }}
      onPointerMove={(e) => dragging.current && fromPointer(e)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
      className="relative h-40 w-full cursor-crosshair touch-none select-none overflow-hidden rounded-lg border border-border/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{
        background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})`,
      }}
    >
      <div
        className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1.5px_rgba(0,0,0,0.5)]"
        style={{
          left: `${hsva.s}%`,
          top: `${100 - hsva.v}%`,
          backgroundColor: serialize({ ...hsva, a: 100 }, false),
        }}
      />
    </div>
  );
}

/** A flat gradient slider for one channel (hue, alpha) — finger-sized, with
 *  arrow keys on the track. */
function ChannelSlider({
  label,
  value,
  max,
  onChange,
  trackStyle,
  thumbColor,
  checker = false,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (v: number) => void;
  trackStyle: React.CSSProperties;
  thumbColor: string;
  checker?: boolean;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const dragging = React.useRef(false);

  const fromPointer = (e: { clientX: number }) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    onChange(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)) * max);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = (e.shiftKey ? 10 : 1) * (max / 100);
    const moves: Record<string, number> = {
      ArrowRight: value + step,
      ArrowUp: value + step,
      ArrowLeft: value - step,
      ArrowDown: value - step,
      Home: 0,
      End: max,
    };
    const next = moves[e.key];
    if (next === undefined) return;
    e.preventDefault();
    onChange(Math.min(max, Math.max(0, next)));
  };

  const pct = (value / max) * 100;
  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      onKeyDown={onKeyDown}
      onPointerDown={(e) => {
        e.preventDefault();
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        e.currentTarget.focus({ preventScroll: true });
        fromPointer(e);
      }}
      onPointerMove={(e) => dragging.current && fromPointer(e)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
      className="relative h-4 w-full cursor-pointer touch-none select-none rounded-full border border-border/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={checker ? CHECKER : undefined}
    >
      <div className="absolute inset-0 rounded-full" style={trackStyle} />
      <div
        className="pointer-events-none absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1.5px_rgba(0,0,0,0.5)]"
        style={{ left: `${pct}%`, backgroundColor: thumbColor }}
      />
    </div>
  );
}

/** Hex text field with a `#` prefix — commits on blur/Enter, reverts on junk. */
function HexField({
  hex,
  alpha,
  onPick,
}: {
  hex: string;
  alpha: boolean;
  onPick: (hex: string) => void;
}) {
  const [draft, setDraft] = React.useState(hex.replace(/^#/, ''));
  React.useEffect(() => setDraft(hex.replace(/^#/, '')), [hex]);

  const commit = () => {
    let h = draft.replace(/[^0-9a-fA-F]/g, '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const ok = alpha ? /^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(h) : /^[0-9a-fA-F]{6}$/.test(h);
    if (ok) onPick('#' + h.toLowerCase());
    else setDraft(hex.replace(/^#/, ''));
  };

  return (
    <div className="relative flex flex-1 items-center">
      <span className="pointer-events-none absolute left-2 text-xs text-muted-foreground">#</span>
      <input
        type="text"
        value={draft}
        spellCheck={false}
        onChange={(e) =>
          setDraft(e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, alpha ? 8 : 6))
        }
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        className="h-9 w-full rounded-md border border-input bg-background pl-5 pr-2 font-mono text-xs uppercase tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Hex colour"
      />
    </div>
  );
}

/** Desktop: a dropdown panel anchored below the trigger (flips above when the
 *  trigger sits near the bottom of the viewport). */
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

  const [placeAbove, setPlaceAbove] = React.useState(false);
  React.useLayoutEffect(() => {
    const t = triggerRef.current?.getBoundingClientRect();
    if (t && window.innerHeight - t.bottom < 420) setPlaceAbove(true);
  }, [triggerRef]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Colour picker"
      className={cn(
        'ds-color-panel absolute left-0 z-50 w-72 rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-2xl',
        placeAbove ? 'bottom-full mb-2' : 'top-full mt-2',
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
      className="ds-color-scrim fixed inset-0 z-[95] flex items-end bg-black/50 backdrop-blur-sm"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-label="Colour picker"
        className="ds-color-sheet max-h-[85vh] w-full overflow-y-auto rounded-t-2xl border-t border-border bg-popover px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 text-popover-foreground shadow-2xl"
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
