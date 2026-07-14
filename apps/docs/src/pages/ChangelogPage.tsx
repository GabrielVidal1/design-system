import { ChangelogPage } from '@gabvdl/ui';

/**
 * /changelog — the full release history of @gabvdl/ui, rendered by the
 * library's own ChangelogPage component (this page IS the live demo). The
 * data is public/changelog.jsonl, generated from CHANGELOG.md at build time
 * by the bundled `gabvdl-changelog from-md` CLI — the same file the header's
 * Changelog modal and the new-version toast poll.
 */
export function ChangelogDocPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <p className="mb-10 text-sm leading-relaxed text-muted-foreground">
        Every release of <span className="mono text-foreground">@gabvdl/ui</span>, straight from{' '}
        <a
          href="https://github.com/GabrielVidal1/design-system/blob/main/CHANGELOG.md"
          target="_blank"
          rel="noreferrer"
          className="text-primary underline-offset-2 hover:underline"
        >
          CHANGELOG.md
        </a>
        {' '}— compiled to JSONL at build time by the package's own{' '}
        <span className="mono text-foreground">gabvdl-changelog</span> CLI. This page, the header's
        changelog modal and the new-version reload toast all read the same file.
      </p>
      <ChangelogPage title={null} />
    </div>
  );
}
