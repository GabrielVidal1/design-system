import { cn } from '../../lib/utils';

import { SECTION_LABEL, SECTION_ORDER, type ChangelogEntry } from './core';

function Bullets({ items, breaking }: { items: string[]; breaking?: boolean }) {
  return (
    <ul className="space-y-1">
      {items.map((c, i) => (
        <li key={i} className="relative pl-4 text-[13px] leading-snug text-muted-foreground">
          <span
            className={cn(
              'absolute left-0 top-2 h-1 w-1 rounded-full',
              breaking ? 'bg-destructive' : 'bg-primary',
            )}
          />
          {c}
        </li>
      ))}
    </ul>
  );
}

/**
 * One changelog entry — version chip, date, title, then the changes either
 * grouped by Keep-a-Changelog section (when `entry.sections` is present) or as
 * a flat bullet list. Shared by the {@link Changelog} modal and
 * {@link ChangelogPage}.
 */
export function ChangelogEntryView({
  entry,
  className,
}: {
  entry: ChangelogEntry;
  className?: string;
}) {
  const showTitle = entry.title && !(entry.changes.length === 1 && entry.changes[0] === entry.title);
  const sections = entry.sections;
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline gap-2">
        <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-bold text-primary">
          v{entry.version}
        </span>
        {entry.date && <span className="text-xs text-muted-foreground">{entry.date}</span>}
      </div>
      {showTitle && <p className="mb-1.5 text-sm font-semibold text-foreground">{entry.title}</p>}
      {sections ? (
        <div className="space-y-2.5">
          {SECTION_ORDER.map((key) => {
            const items = sections[key];
            if (!items || items.length === 0) return null;
            return (
              <div key={key}>
                <p
                  className={cn(
                    'mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em]',
                    key === 'breaking' ? 'text-destructive' : 'text-muted-foreground',
                  )}
                >
                  {SECTION_LABEL[key]}
                </p>
                <Bullets items={items} breaking={key === 'breaking'} />
              </div>
            );
          })}
        </div>
      ) : (
        <Bullets items={entry.changes} />
      )}
    </div>
  );
}
