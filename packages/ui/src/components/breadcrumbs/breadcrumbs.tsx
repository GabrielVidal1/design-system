import { ChevronRight, MoreHorizontal } from 'lucide-react';
import * as React from 'react';

import { useIsMobile } from '../../hooks/use-media-query';
import { cn } from '../../lib/utils';

export interface BreadcrumbItem {
  /** Unique key — falls back to `label` if omitted. */
  key?: string;
  label: React.ReactNode;
  /** Rendered as an `<a>` when set; otherwise a plain button (or static text for the current item). */
  href?: string;
  onClick?: () => void;
  icon?: React.ReactNode;
}

export interface BreadcrumbsProps extends Omit<React.HTMLAttributes<HTMLElement>, 'onClick'> {
  items: BreadcrumbItem[];
  /**
   * Collapse the middle into a "…" once there are more than this many items,
   * always keeping the first and the last two. `0` disables collapsing.
   * Defaults to 4 on desktop, 3 on phones (narrower strip, same idea).
   */
  maxItems?: number;
  /** Custom separator between crumbs (default: a chevron). */
  separator?: React.ReactNode;
}

/**
 * A trail of ancestor links back to the root — last item is the current page
 * (rendered as plain text, `aria-current="page"`). Middle items collapse
 * behind a "…" that expands to the full trail on tap/click once there are
 * more crumbs than fit.
 *
 * @summary Ancestor trail (`Home / Section / … / Page`) that collapses its
 * middle into a tappable "…" once it has too many crumbs.
 */
export function Breadcrumbs({
  items,
  maxItems,
  separator,
  className,
  ...props
}: BreadcrumbsProps) {
  const isMobile = useIsMobile();
  const [expanded, setExpanded] = React.useState(false);
  const limit = maxItems ?? (isMobile ? 3 : 4);

  const visible = React.useMemo(() => {
    if (expanded || limit <= 0 || items.length <= limit) {
      return items.map((item, i) => ({ item, collapsed: false, i }));
    }
    // Keep the first item, then the last (limit - 1) items, "…" in between.
    const tailCount = Math.max(limit - 1, 1);
    const tail = items.slice(items.length - tailCount);
    const out: { item: BreadcrumbItem; collapsed: boolean; i: number }[] = [
      { item: items[0], collapsed: false, i: 0 },
      { item: { label: '…' }, collapsed: true, i: -1 },
    ];
    const tailStart = items.length - tail.length;
    tail.forEach((item, j) => out.push({ item, collapsed: false, i: tailStart + j }));
    return out;
  }, [items, expanded, limit]);

  return (
    <nav aria-label="Breadcrumb" className={cn('min-w-0', className)} {...props}>
      <ol className="flex min-w-0 flex-wrap items-center gap-1 text-sm">
        {visible.map(({ item, collapsed, i }, idx) => {
          const isLast = idx === visible.length - 1;
          const key = collapsed ? 'ellipsis' : (item.key ?? (typeof item.label === 'string' ? item.label : i));
          return (
            <li key={key} className="flex min-w-0 items-center gap-1">
              {idx > 0 && (
                <span className="text-muted-foreground/60 shrink-0" aria-hidden>
                  {separator ?? <ChevronRight className="size-3.5" />}
                </span>
              )}
              {collapsed ? (
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Show hidden breadcrumbs"
                >
                  <MoreHorizontal className="size-3.5" />
                </button>
              ) : isLast ? (
                <span
                  aria-current="page"
                  className="flex min-w-0 items-center gap-1.5 truncate font-medium text-foreground"
                >
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </span>
              ) : (
                <Crumb item={item} />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function Crumb({ item }: { item: BreadcrumbItem }) {
  if (item.href) {
    return (
      <a
        href={item.href}
        onClick={item.onClick}
        className="flex min-w-0 items-center gap-1.5 truncate rounded-md px-1 -mx-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        {item.icon}
        <span className="truncate">{item.label}</span>
      </a>
    );
  }
  if (item.onClick) {
    return (
      <button
        type="button"
        onClick={item.onClick}
        className="flex min-w-0 items-center gap-1.5 truncate rounded-md px-1 -mx-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        {item.icon}
        <span className="truncate">{item.label}</span>
      </button>
    );
  }
  return (
    <span className="flex min-w-0 items-center gap-1.5 truncate text-muted-foreground">
      {item.icon}
      <span className="truncate">{item.label}</span>
    </span>
  );
}
