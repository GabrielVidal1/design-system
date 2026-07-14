import type { ReactNode } from 'react';

import { cn } from '../../lib/utils';

import { DEFAULT_CHANGELOG_URL, type ChangelogEntry } from './core';
import { ChangelogEntryView } from './entry';
import { useChangelog } from './use-changelog';

export interface ChangelogPageProps {
  /** Supply entries directly. Omit to fetch `url`. */
  entries?: ChangelogEntry[];
  /** URL of the JSONL changelog. Default: /changelog.jsonl */
  url?: string;
  /** Page heading. Default: "Changelog". Pass null to render no header. */
  title?: string | null;
  /** Blurb under the heading. */
  description?: ReactNode;
  className?: string;
  emptyState?: ReactNode;
}

/**
 * A complete release-history page: heading, blurb, and every version as an
 * anchored block (`#v1.2.3` deep-links to its release). Drop it on a
 * `/changelog` route; data comes from the same JSONL the {@link Changelog}
 * modal and toast read. Long histories render fine — entries are plain blocks,
 * so in-page anchors and Ctrl-F keep working.
 */
export function ChangelogPage({
  entries,
  url = DEFAULT_CHANGELOG_URL,
  title = 'Changelog',
  description,
  className,
  emptyState,
}: ChangelogPageProps) {
  const controlled = entries !== undefined;
  const { entries: loaded, loading } = useChangelog({ url, enabled: !controlled });
  const data = controlled ? entries : loaded;

  return (
    <div className={cn('mx-auto w-full max-w-2xl', className)}>
      {title !== null && (
        <header className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
        </header>
      )}
      {data.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          {loading && !controlled ? 'Loading…' : (emptyState ?? 'No changelog yet.')}
        </div>
      ) : (
        <ol className="space-y-0">
          {data.map((e) => (
            <li
              key={e.version}
              id={`v${e.version}`}
              className="scroll-mt-24 border-b border-border py-6 first:pt-0 last:border-none"
            >
              <ChangelogEntryView entry={e} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
