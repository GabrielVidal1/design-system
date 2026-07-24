import * as React from 'react';
import { createPortal } from 'react-dom';

import { cn } from '../../lib/utils';
import { useIsTouch } from '../../hooks/use-media-query';
import { classify } from './parse';
import { useElementPicker, type UseElementPickerOptions, type UseElementPickerResult } from './use-element-picker';

/** The devtools box-model palette — deliberately not theme tokens: these have to
 * read over whatever the page happens to be painted in. */
const BOX_COLORS = {
  margin: 'rgba(246, 178, 107, 0.45)',
  border: 'rgba(253, 224, 71, 0.45)',
  padding: 'rgba(147, 197, 114, 0.45)',
  content: 'rgba(111, 168, 220, 0.45)',
};

interface Geometry {
  margin: DOMRect;
  border: DOMRect;
  padding: DOMRect;
  content: DOMRect;
}

const px = (v: string) => parseFloat(v) || 0;

/** Peel the four boxes apart, the way the inspector draws them. */
function geometryOf(el: HTMLElement): Geometry {
  const r = el.getBoundingClientRect();
  const s = getComputedStyle(el);

  const inset = (rect: DOMRect, top: number, right: number, bottom: number, left: number) =>
    new DOMRect(rect.x + left, rect.y + top, Math.max(rect.width - left - right, 0), Math.max(rect.height - top - bottom, 0));

  const border = new DOMRect(r.x, r.y, r.width, r.height);
  const margin = inset(border, -px(s.marginTop), -px(s.marginRight), -px(s.marginBottom), -px(s.marginLeft));
  const padding = inset(border, px(s.borderTopWidth), px(s.borderRightWidth), px(s.borderBottomWidth), px(s.borderLeftWidth));
  const content = inset(padding, px(s.paddingTop), px(s.paddingRight), px(s.paddingBottom), px(s.paddingLeft));

  return { margin, border, padding, content };
}

const sameRect = (a: DOMRect | undefined, b: DOMRect | undefined) =>
  !!a && !!b && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

const sameGeom = (a: Geometry | null, b: Geometry | null) =>
  a === b ||
  (!!a && !!b && sameRect(a.margin, b.margin) && sameRect(a.border, b.border) && sameRect(a.padding, b.padding) && sameRect(a.content, b.content));

const sameRects = (a: DOMRect[], b: DOMRect[]) => a.length === b.length && a.every((r, i) => sameRect(r, b[i]));

const box = (rect: DOMRect, background: string): React.CSSProperties => ({
  position: 'fixed',
  left: rect.x,
  top: rect.y,
  width: rect.width,
  height: rect.height,
  background,
});

/** Short name for an element: `div.card`, `#hero`, `button`. */
function shortName(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase();
  if (el.id) return `${tag}#${el.id}`;
  const cls = Array.from(el.classList)[0];
  return cls ? `${tag}.${cls}` : tag;
}

/** The floating badge: what it is, and how big. */
function HoverLabel({ el, geom }: { el: HTMLElement; geom: Geometry }) {
  const { border } = geom;
  const above = border.y > 30;

  return (
    <div
      style={{
        position: 'fixed',
        left: Math.max(border.x, 4),
        top: above ? border.y - 26 : border.bottom + 4,
        maxWidth: 'calc(100vw - 8px)',
      }}
      className="pointer-events-none flex items-center gap-1.5 truncate rounded-md bg-slate-900/95 px-2 py-1 text-[11px] font-medium text-white shadow-lg ring-1 ring-white/10"
    >
      <span className="font-mono text-sky-300">{shortName(el)}</span>
      <span className="text-slate-500">·</span>
      <span className="text-slate-300">{classify(el)}</span>
      <span className="text-slate-500">·</span>
      <span className="font-mono text-slate-400">
        {Math.round(border.width)}×{Math.round(border.height)}
      </span>
    </div>
  );
}

export interface ElementPickerOverlayProps {
  /** A live picker, from `useElementPicker`. */
  picker: UseElementPickerResult;
  /** Keep an outline on everything already selected. Default true. */
  highlightSelected?: boolean;
  /** Replace the instruction bar, or pass `false` to drop it. */
  hint?: React.ReactNode | false;
  /** Render into something other than `document.body`. */
  container?: HTMLElement | null;
  className?: string;
}

/**
 * The chrome on its own — box-model highlight, hover label, instruction bar —
 * driven by a picker you already own. `ElementPicker` is this plus the hook.
 */
export function ElementPickerOverlay({
  picker,
  highlightSelected = true,
  hint,
  container,
  className,
}: ElementPickerOverlayProps) {
  const { active, hovered, holding, picked, stop, ignoreProps } = picker;
  const touch = useIsTouch();

  const [geom, setGeom] = React.useState<Geometry | null>(null);
  const [selectedRects, setSelectedRects] = React.useState<DOMRect[]>([]);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  // Rects go stale the moment anything scrolls or animates, and there's no event
  // that covers every cause. A frame loop while picking is the honest fix.
  React.useEffect(() => {
    if (!active || !mounted) {
      setGeom(null);
      setSelectedRects([]);
      return;
    }

    let frame = 0;
    const tick = () => {
      // Re-measure every frame, but only re-render when something moved —
      // sitting still on one element costs nothing.
      const next = hovered?.isConnected ? geometryOf(hovered) : null;
      setGeom((prev) => (sameGeom(prev, next) ? prev : next));

      const rects = highlightSelected
        ? picked.filter((p) => p.element.isConnected).map((p) => p.element.getBoundingClientRect())
        : [];
      setSelectedRects((prev) => (sameRects(prev, rects) ? prev : rects));

      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, mounted, hovered, picked, highlightSelected]);

  if (!mounted || !active) return null;

  const host = container ?? document.body;
  const instructions =
    hint === false ? null : hint ?? (
      <>
        <span className="font-medium text-white">
          {touch ? 'Press and hold, then drag' : 'Hover to preview'}
        </span>
        <span className="hidden text-slate-500 sm:inline">·</span>
        <span className="hidden sm:inline">{touch ? 'lift to select' : 'click to select'}</span>
        {!touch && (
          <>
            <span className="hidden text-slate-500 sm:inline">·</span>
            <span className="hidden sm:inline">
              <kbd className="rounded border border-white/20 px-1 font-mono text-[10px]">↑</kbd> parent
            </span>
          </>
        )}
      </>
    );

  return (
    <>
      {createPortal(
        <div
          {...ignoreProps}
          className={cn('pointer-events-none fixed inset-0 z-[9998]', className)}
          aria-hidden
        >
          {geom && (
            <>
              <div style={box(geom.margin, BOX_COLORS.margin)} />
              <div style={box(geom.border, BOX_COLORS.border)} />
              <div style={box(geom.padding, BOX_COLORS.padding)} />
              <div style={box(geom.content, BOX_COLORS.content)} />
            </>
          )}

          {selectedRects.map((rect, i) => (
            <div
              key={i}
              style={{
                position: 'fixed',
                left: rect.x - 1,
                top: rect.y - 1,
                width: rect.width + 2,
                height: rect.height + 2,
              }}
              className="rounded-[3px] outline-2 outline-offset-0 outline-sky-500"
            >
              <span className="absolute -top-1.5 -left-1.5 flex size-4 items-center justify-center rounded-full bg-sky-500 text-[9px] font-bold text-white shadow">
                {i + 1}
              </span>
            </div>
          ))}

          {hovered && geom && <HoverLabel el={hovered} geom={geom} />}

          {instructions && (
            <div
              {...ignoreProps}
              className="pointer-events-auto fixed inset-x-0 bottom-4 mx-auto flex w-fit max-w-[calc(100vw-1rem)] items-center gap-2 rounded-full bg-slate-900/95 py-2 pr-2 pl-4 text-xs text-slate-300 shadow-xl ring-1 ring-white/10 backdrop-blur"
            >
              {holding && <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />}
              {instructions}
              {picked.length > 0 && (
                <span className="rounded-full bg-sky-500/20 px-2 py-0.5 font-medium text-sky-300">
                  {picked.length} selected
                </span>
              )}
              <button
                type="button"
                onClick={stop}
                className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-900 transition-colors hover:bg-slate-200"
              >
                Done
              </button>
            </div>
          )}
        </div>,
        host,
      )}
    </>
  );
}

export interface ElementPickerProps extends UseElementPickerOptions {
  /** Keep an outline on everything already selected. Default true. */
  highlightSelected?: boolean;
  /** Replace the instruction bar, or pass `false` to drop it. */
  hint?: React.ReactNode | false;
  /** Render the overlay into something other than `document.body`. */
  container?: HTMLElement | null;
  /** Handed the live picker, so a toolbar of your own can drive it. */
  children?: (picker: UseElementPickerResult) => React.ReactNode;
  className?: string;
}

/**
 * Point at the page and take it apart: hover any element to preview it, click
 * to select. It draws the devtools box model over whatever is under the cursor
 * — margin, border, padding, content — and hands back both the live node and a
 * serializable parse of it: text, kind, hierarchy position, computed styles.
 *
 * A touchscreen has no hover, so there it's a gesture: **press and hold**, then
 * drag. Elements light up under your finger as it moves and the one you lift on
 * is the one you pick. Until the hold registers, the page still scrolls.
 *
 * This renders only the overlay. `children` is a render prop for your own
 * trigger; for the batteries-included input — thumbnails, HTML, parsed output —
 * reach for `ElementPickerField`.
 *
 * @summary Point at any DOM element on the page (hover / click / press-and-hold) and
 * get its full HTML plus a parsed description — selector, hierarchy,
 * computed style groups. Powers "pick an element" editor flows.
 */
export function ElementPicker({
  highlightSelected = true,
  hint,
  container,
  children,
  className,
  ...options
}: ElementPickerProps) {
  const picker = useElementPicker(options);

  return (
    <>
      {children?.(picker)}
      <ElementPickerOverlay
        picker={picker}
        highlightSelected={highlightSelected}
        hint={hint}
        container={container}
        className={className}
      />
    </>
  );
}
