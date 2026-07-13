import * as React from 'react';

import { cn } from '../../lib/utils';

/** Nothing that could run, load or navigate survives the clone. */
const STRIP = 'script, iframe, object, embed, link[rel="import"]';

/**
 * `cloneNode` copies the *attributes*, not the live state — a typed-in input
 * comes back empty, a checked box unchecked. Walk the pairs and put it back.
 */
function copyFieldState(from: HTMLElement, to: HTMLElement) {
  const originals = [from, ...Array.from(from.querySelectorAll<HTMLElement>('input, textarea, select'))];
  const clones = [to, ...Array.from(to.querySelectorAll<HTMLElement>('input, textarea, select'))];

  originals.forEach((el, i) => {
    const clone = clones[i];
    if (!clone) return;

    if (el instanceof HTMLInputElement && clone instanceof HTMLInputElement) {
      clone.setAttribute('value', el.value);
      if (el.checked) clone.setAttribute('checked', '');
      else clone.removeAttribute('checked');
    } else if (el instanceof HTMLTextAreaElement && clone instanceof HTMLTextAreaElement) {
      clone.textContent = el.value;
    } else if (el instanceof HTMLSelectElement && clone instanceof HTMLSelectElement) {
      Array.from(clone.options).forEach((o, oi) => {
        if (el.options[oi]?.selected) o.setAttribute('selected', '');
        else o.removeAttribute('selected');
      });
    }
  });
}

/** The colour actually painted behind the element, so light text stays legible. */
function backdropOf(el: HTMLElement): string | undefined {
  for (let node: HTMLElement | null = el; node; node = node.parentElement) {
    const bg = getComputedStyle(node).backgroundColor;
    if (bg && bg !== 'transparent' && !/rgba\(0, 0, 0, 0\)/.test(bg)) return bg;
  }
  return undefined;
}

export interface ElementPreviewProps {
  /** The element to mirror. A detached or null node renders the fallback. */
  element: HTMLElement | null;
  /** Height of the preview box, in px. Default 120. */
  height?: number;
  /** Never enlarge past 1:1, only shrink to fit. Default true. */
  shrinkOnly?: boolean;
  /**
   * Floor on the scale. Below it the preview crops from the top-left instead of
   * shrinking further — a 900px-wide heading fitted into a thumbnail is two
   * pixels of grey, where its first few words are recognisable. Default 0.
   */
  minScale?: number;
  className?: string;
}

/**
 * A live, inert clone of an element, scaled to fit its box. Because the copy
 * sits in the same document it inherits the same stylesheets, so it looks
 * exactly like the thing it came from — the page's CSS does the work.
 */
export function ElementPreview({
  element,
  height = 120,
  shrinkOnly = true,
  minScale = 0,
  className,
}: ElementPreviewProps) {
  const host = React.useRef<HTMLDivElement>(null);
  const stage = React.useRef<HTMLDivElement>(null);
  const [empty, setEmpty] = React.useState(true);

  React.useEffect(() => {
    const frame = host.current;
    const surface = stage.current;
    if (!frame || !surface) return;

    surface.replaceChildren();
    if (!element?.isConnected) {
      setEmpty(true);
      return;
    }
    setEmpty(false);

    const rect = element.getBoundingClientRect();
    const clone = element.cloneNode(true) as HTMLElement;
    clone.querySelectorAll(STRIP).forEach((n) => n.remove());
    copyFieldState(element, clone);

    // Freeze it at the size it really is — a clone out of its flex/grid parent
    // would otherwise collapse or stretch to the preview box instead.
    clone.style.width = `${rect.width}px`;
    clone.style.height = `${rect.height}px`;
    clone.style.margin = '0';
    clone.style.flex = '0 0 auto';
    clone.inert = true;

    surface.style.width = `${rect.width}px`;
    surface.style.height = `${rect.height}px`;
    surface.appendChild(clone);

    const backdrop = backdropOf(element);
    if (backdrop) frame.style.backgroundColor = backdrop;

    const fit = () => {
      const box = frame.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const raw = Math.min(box.width / rect.width, box.height / rect.height);
      const fitted = shrinkOnly ? Math.min(raw, 1) : raw;
      const scale = Math.max(fitted, minScale);

      // Centre what fits; anchor what doesn't, so a crop starts at the corner
      // you'd actually read from.
      const cropped = scale > fitted;
      const tx = cropped ? 0 : Math.max((box.width - rect.width * scale) / 2, 0);
      const ty = cropped ? 0 : Math.max((box.height - rect.height * scale) / 2, 0);
      surface.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(frame);
    return () => {
      ro.disconnect();
      surface.replaceChildren();
    };
  }, [element, shrinkOnly, minScale, height]);

  return (
    <div
      ref={host}
      style={{ height }}
      aria-hidden
      className={cn(
        'pointer-events-none relative overflow-hidden rounded-lg border border-border bg-muted/30',
        className,
      )}
    >
      <div ref={stage} className="absolute top-0 left-0 origin-top-left" />
      {empty && (
        <span className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
          No preview
        </span>
      )}
    </div>
  );
}
