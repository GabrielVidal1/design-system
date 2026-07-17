import { useState } from 'react';
import { PhonePreview, useTheme } from '@gabvdl/ui';

/*
 * Desktop-only phone rails: the same route (or a bare demo route) re-loaded in
 * a PhonePreview iframe at a real 390px viewport, so what the phone shows is
 * the genuine mobile layout — media queries, useIsMobile, bottom sheets — not
 * a squeezed desktop one. The iframes are keyed on the resolved theme: the
 * embedded app reads the shared localStorage theme at load, so a toggle in
 * the parent reloads the phone into the matching theme.
 */

/** Same-app URL for a hash route, iframe-safe in dev and deployed alike. */
const routeUrl = (route: string) => `${window.location.pathname}${window.location.search}#${route}`;

/**
 * The component page's phone: the entry's live demo alone on `/preview/:id`.
 * Lives in the right-hand gutter of the centered column, so it only appears
 * once the viewport is wide enough to have that gutter.
 */
export function ComponentPhoneRail({ id }: { id: string }) {
  const { resolved } = useTheme();
  return (
    <aside className="absolute top-0 bottom-0 left-full ml-10 hidden w-[244px] min-[1400px]:block">
      <div className="sticky top-24">
        <p className="eyebrow mb-2.5 text-muted-foreground">On a phone</p>
        <PhonePreview key={resolved} src={routeUrl(`/preview/${id}`)} screenWidth={220} title={`${id} demo on a phone`} />
        <p className="mono mt-3 text-[10.5px] leading-relaxed text-muted-foreground">
          the same demo in a 390px viewport — real mobile layout, not a resize
        </p>
      </div>
    </aside>
  );
}

/** The full-page demos' phone: this very route, phone-framed beside the app. */
export function DemoPhoneRail() {
  const { resolved } = useTheme();
  // Captured at mount — each demo page mounts its own DemoShell, so this is
  // always the URL of the demo being shown.
  const [href] = useState(() => window.location.href);
  return (
    <aside className="hidden w-[300px] shrink-0 flex-col items-center justify-center gap-3 overflow-y-auto border-l border-border bg-[var(--surface)] px-5 py-6 xl:flex">
      <PhonePreview key={resolved} src={href} screenWidth={230} title="This demo on a phone" />
      <p className="mono max-w-[250px] text-center text-[10.5px] leading-relaxed text-muted-foreground">
        the same screen in a 390px viewport
      </p>
    </aside>
  );
}
