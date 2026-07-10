import { useEffect, useRef, useState } from 'react';

import { cn } from '../../lib/utils';

/**
 * A blurry thumbnail that upgrades to the full-resolution image once it scrolls
 * into view (IntersectionObserver), then cross-fades the sharp image in on load.
 *
 * The thumbnail paints instantly (already small / often cached from a grid); the
 * full image is only fetched when the tile nears the viewport, so a gallery with
 * dozens of images doesn't download every full-res file up front.
 */
export function ProgressiveImage({
  thumb,
  full,
  alt,
  className,
  imgClassName,
}: {
  /** Small placeholder shown (blurred) until the full image loads. */
  thumb?: string;
  /** Full-resolution source; loaded lazily when in view. */
  full: string;
  alt: string;
  /** Container classes (size / rounding / overflow live here). */
  className?: string;
  /** Extra classes applied to the sharp `<img>` (e.g. hover transforms). */
  imgClassName?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Fallback for environments without IntersectionObserver: load immediately.
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      // Start fetching a bit before the tile actually enters the viewport. Kept
      // modest so a fast scroll doesn't kick off a burst of decodes far ahead of
      // where the user actually is.
      { rootMargin: '200px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={cn('relative bg-muted', className)}>
      {thumb && (
        <img
          src={thumb}
          alt=""
          aria-hidden
          decoding="async"
          className={cn(
            'absolute inset-0 h-full w-full scale-105 object-cover blur-md transition-opacity duration-300',
            loaded ? 'opacity-0' : 'opacity-100',
          )}
        />
      )}
      {inView && (
        <img
          src={full}
          alt={alt}
          decoding="async"
          onLoad={() => setLoaded(true)}
          className={cn(
            'absolute inset-0 h-full w-full object-cover transition-opacity duration-300',
            loaded ? 'opacity-100' : 'opacity-0',
            imgClassName,
          )}
        />
      )}
    </div>
  );
}
