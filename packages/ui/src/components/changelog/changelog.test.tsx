import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { Changelog, NewVersionToast } from './changelog';
import { ChangelogPage } from './changelog-page';
import { compareSemver, latestEntry, parseChangelog, type ChangelogEntry } from './core';

// The modal's entry list is a VirtualList; @tanstack/react-virtual reads the
// container's offsetHeight, which is always 0 in jsdom — stub a real box so
// rows actually mount (same approach as virtual-list.test.tsx).
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    value: 600,
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    value: 600,
  });
});

describe('compareSemver', () => {
  it('orders major/minor/patch', () => {
    expect(compareSemver('1.0.0', '0.9.9')).toBe(1);
    expect(compareSemver('0.10.0', '0.9.0')).toBe(1);
    expect(compareSemver('0.1.2', '0.1.10')).toBe(-1);
    expect(compareSemver('2.0.0', '2.0.0')).toBe(0);
  });

  it('ranks releases above prereleases', () => {
    expect(compareSemver('1.0.0', '1.0.0-rc.1')).toBe(1);
    expect(compareSemver('1.0.0-rc.2', '1.0.0-rc.1')).toBe(1);
  });

  it('tolerates a leading v', () => {
    expect(compareSemver('v1.2.3', '1.2.3')).toBe(0);
  });
});

describe('parseChangelog', () => {
  it('parses JSONL newest-first, skipping bad lines', () => {
    const text = [
      '{"version":"0.1.0","changes":["first"]}',
      'not json at all',
      '{"version":"nope","changes":["invalid version"]}',
      '{"version":"0.2.0","date":"2026-01-02","title":"Two","changes":["a","b"]}',
    ].join('\n');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const entries = parseChangelog(text);
    warn.mockRestore();
    expect(entries.map((e) => e.version)).toEqual(['0.2.0', '0.1.0']);
    expect(entries[0].title).toBe('Two');
    expect(entries[1].title).toBe('first'); // title falls back to first change
  });

  it('keeps sections and derives the flat changes list from them', () => {
    const entries = parseChangelog(
      '{"version":"1.0.0","sections":{"added":["x"],"fixed":["y"],"bogus":["dropped"]}}',
    );
    expect(entries[0].sections).toEqual({ added: ['x'], fixed: ['y'] });
    expect(entries[0].changes).toEqual(['x', 'y']);
  });

  it('de-dupes by version, last write wins', () => {
    const entries = parseChangelog(
      '{"version":"1.0.0","changes":["old"]}\n{"version":"1.0.0","changes":["new"]}',
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].changes).toEqual(['new']);
  });
});

describe('latestEntry', () => {
  it('finds the highest semver even unsorted', () => {
    const entries = parseChangelog(
      '{"version":"0.2.0","changes":["a"]}\n{"version":"1.0.0","changes":["b"]}',
    );
    expect(latestEntry(entries)?.version).toBe('1.0.0');
    expect(latestEntry([])).toBeNull();
  });
});

const ENTRIES: ChangelogEntry[] = [
  {
    version: '0.2.0',
    date: '2026-01-02',
    title: 'Sectioned release',
    changes: ['added thing', 'fixed thing'],
    sections: { added: ['added thing'], fixed: ['fixed thing'], breaking: ['renamed prop'] },
  },
  { version: '0.1.0', date: '2026-01-01', title: 'First', changes: ['hello world'] },
];

describe('Changelog (controlled)', () => {
  it('opens the modal from the default trigger and lists entries', async () => {
    const user = userEvent.setup();
    render(<Changelog entries={ENTRIES} />);
    await user.click(screen.getByRole('button', { name: 'Changelog' }));
    expect(screen.getByText('v0.2.0')).toBeInTheDocument();
    expect(screen.getByText('Sectioned release')).toBeInTheDocument();
  });

  it('shows the controlled new-version toast and dismisses it', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <Changelog entries={ENTRIES} newVersion={ENTRIES[0]} onDismissNewVersion={onDismiss} />,
    );
    expect(screen.getByText(/New version · v0\.2\.0/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalled();
  });
});

describe('NewVersionToast', () => {
  it('renders the version and reloads on click', async () => {
    const user = userEvent.setup();
    const reload = vi.fn();
    const original = window.location;
    Object.defineProperty(window, 'location', {
      value: { ...original, reload },
      writable: true,
    });
    render(<NewVersionToast entry={ENTRIES[1]} />);
    await user.click(screen.getByRole('button', { name: 'Reload' }));
    expect(reload).toHaveBeenCalled();
    Object.defineProperty(window, 'location', { value: original, writable: true });
  });
});

describe('ChangelogPage', () => {
  it('renders anchored version blocks with grouped sections', () => {
    const { container } = render(
      <ChangelogPage entries={ENTRIES} description="All releases." />,
    );
    expect(screen.getByRole('heading', { name: 'Changelog' })).toBeInTheDocument();
    expect(container.querySelector('#v0\\.2\\.0')).not.toBeNull();
    expect(container.querySelector('#v0\\.1\\.0')).not.toBeNull();
    expect(screen.getByText('Breaking')).toBeInTheDocument();
    expect(screen.getByText('Added')).toBeInTheDocument();
    expect(screen.getByText('renamed prop')).toBeInTheDocument();
  });

  it('shows the empty state without entries', () => {
    render(<ChangelogPage entries={[]} emptyState="Nothing yet" />);
    expect(screen.getByText('Nothing yet')).toBeInTheDocument();
  });
});
