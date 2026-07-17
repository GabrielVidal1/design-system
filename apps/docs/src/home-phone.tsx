import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { PhonePreview } from '@gabvdl/ui';

gsap.registerPlugin(ScrollTrigger);

/*
 * The homepage's sticky phone — a phone-framed mirror of the catalogue that
 * scrolls itself to whatever the desktop page is looking at.
 *
 * Sync model: the page marks its hero, group headers and component cards with
 * `data-sync-id`; the phone's screen carries the same content marked with
 * `data-phone-id`. Matching pairs become (pageY, phoneY) anchors, and the
 * phone's scrollTop is the piecewise-linear interpolation of the page's
 * reading line through them — so the phone tracks the desktop scroll
 * component by component, not as one dumb proportional map. A gsap quickTo
 * glides scrollTop toward the target on every ScrollTrigger tick: smooth,
 * but retargeted instantly on direction changes.
 */

export interface PhoneGroupData {
  group: string;
  items: { id: string; name: string; sig: string; Icon: () => ReactNode }[];
}

/** Fraction of the viewport height where the page's "reading line" sits. */
const PAGE_FOCUS = 0.35;
/** Where the matched content should sit inside the phone screen. */
const PHONE_FOCUS = 0.4;

function usePhoneScrollSync(contentRef: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const content = contentRef.current;
    // PhonePreview wraps children in its own overflow-auto screen div — that
    // wrapper (our parent) is the element that actually scrolls.
    const scroller = content?.parentElement;
    if (!content || !scroller) return;

    let anchors: { pageY: number; phoneY: number; span?: number }[] = [];

    const measure = () => {
      if (!scroller.clientHeight) return; // rail is display:none below xl
      const twins = new Map<string, HTMLElement>();
      content.querySelectorAll<HTMLElement>('[data-phone-id]').forEach((el) => {
        twins.set(el.dataset.phoneId!, el);
      });
      const contentTop = content.getBoundingClientRect().top;
      const next: typeof anchors = [{ pageY: 0, phoneY: 0 }];
      document.querySelectorAll<HTMLElement>('[data-sync-id]').forEach((el) => {
        const twin = twins.get(el.dataset.syncId!);
        if (!twin || !el.offsetParent) return;
        const page = el.getBoundingClientRect();
        const phone = twin.getBoundingClientRect();
        next.push({
          pageY: window.scrollY + page.top + page.height / 2,
          phoneY: phone.top - contentTop + phone.height / 2,
        });
      });
      next.sort((a, b) => a.pageY - b.pageY);
      // Cards sharing a grid row share one pageY; keep one anchor per row,
      // aimed at the row's average phone position, so the phone frames the
      // whole row instead of pinning to whichever card sorted first.
      const merged: typeof next = [];
      for (const a of next) {
        const prev = merged[merged.length - 1];
        if (prev && Math.abs(a.pageY - prev.pageY) < 24) {
          prev.phoneY += (a.phoneY - prev.phoneY) / ++prev.span!;
        } else {
          merged.push({ ...a, span: 1 });
        }
      }
      anchors = merged;
    };

    const target = () => {
      const max = scroller.scrollHeight - scroller.clientHeight;
      if (anchors.length < 2 || max <= 0) return 0;
      const y = window.scrollY + window.innerHeight * PAGE_FOCUS;
      let hi = anchors.findIndex((a) => a.pageY > y);
      if (hi === -1) hi = anchors.length - 1;
      const lo = Math.max(0, hi - 1);
      const a = anchors[lo];
      const b = anchors[hi];
      const f = b.pageY === a.pageY ? 1 : Math.min(1, Math.max(0, (y - a.pageY) / (b.pageY - a.pageY)));
      const phoneY = a.phoneY + (b.phoneY - a.phoneY) * f;
      return Math.min(max, Math.max(0, phoneY - scroller.clientHeight * PHONE_FOCUS));
    };

    // Tween a proxy and copy it onto scrollTop — element scroll positions
    // aren't CSS properties, so this keeps gsap on a plain numeric target.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const proxy = { y: scroller.scrollTop };
    const apply = () => {
      scroller.scrollTop = proxy.y;
    };
    const glide = gsap.quickTo(proxy, 'y', {
      duration: reduced ? 0 : 0.55,
      ease: 'power3.out',
      onUpdate: apply,
    });
    const jump = () => {
      measure();
      proxy.y = target();
      apply();
    };

    const st = ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate: () => glide(target()),
      // Refresh fires on resize / load — geometry changed, so re-anchor.
      onRefresh: jump,
    });
    jump();
    // Web fonts landing late shift every card's Y — re-anchor once they're in.
    document.fonts?.ready.then(() => ScrollTrigger.refresh()).catch(() => {});

    return () => {
      st.kill();
      gsap.killTweensOf(proxy);
    };
  }, [contentRef]);
}

/** The screen content: a phone-sized mirror of the hero + grouped catalogue. */
export function HomePhone({ groups, version }: { groups: PhoneGroupData[]; version: string }) {
  const contentRef = useRef<HTMLDivElement>(null);
  usePhoneScrollSync(contentRef);

  return (
    <div>
      <PhonePreview screenWidth={260} statusBar title="The catalogue at phone width">
        <div ref={contentRef} className="bg-background pb-12">
          <div data-phone-id="hero" className="px-4 pt-5 pb-2">
            <p className="eyebrow mb-2">gabvdl/ui · v{version}</p>
            <h2 className="display text-xl leading-snug text-foreground">
              A personal component library, catalogued.
            </h2>
            <code className="mono mt-3 inline-block rounded-md border border-border bg-[var(--surface)] px-2.5 py-1.5 text-[11px] text-foreground">
              npm i @gabvdl/ui
            </code>
          </div>
          {groups.map(({ group, items }) => (
            <div key={group} className="px-4 pt-5">
              <div
                data-phone-id={`group:${group}`}
                className="flex items-baseline justify-between gap-3 border-b border-border pb-2"
              >
                <h3 className="display text-sm text-foreground">{group}</h3>
                <span className="mono text-[10px] tabular-nums text-muted-foreground">
                  {String(items.length).padStart(2, '0')}
                </span>
              </div>
              <div className="mt-3 space-y-3">
                {items.map(({ id, name, sig, Icon }) => (
                  <Link
                    key={id}
                    to={`/c/${id}`}
                    data-phone-id={id}
                    className="comp-card group block text-left"
                    aria-label={`Open ${name}`}
                  >
                    <div className="comp-card__art" style={{ height: 84 }}>
                      <Icon />
                    </div>
                    <div className="min-w-0 p-3">
                      <div className="mono text-[13px] text-foreground">{name}</div>
                      <div className="mono mt-0.5 truncate text-[10px] text-muted-foreground">{sig}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PhonePreview>
      <p className="mono mt-3 px-1 text-center text-[10.5px] leading-relaxed text-muted-foreground">
        the same catalogue at phone width — it follows your scroll
      </p>
    </div>
  );
}
