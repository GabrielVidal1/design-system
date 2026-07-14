import { describe, expect, it } from 'vitest';

import {
  bump,
  conventionalLevel,
  draftUnreleased,
  parseConventional,
  parseKeepAChangelog,
  parseVer,
  sectionOf,
  seedEntries,
  stripMd,
} from './changelog.mjs';

describe('conventionalLevel', () => {
  it('maps commit subjects to bump levels', () => {
    expect(conventionalLevel('feat(ui): add thing')).toBe('minor');
    expect(conventionalLevel('feat!: break thing')).toBe('major');
    expect(conventionalLevel('fix: repair thing')).toBe('patch');
    expect(conventionalLevel('random subject')).toBe('patch');
    expect(conventionalLevel('chore: BREAKING CHANGE noted')).toBe('major');
  });
});

describe('parseConventional / sectionOf', () => {
  it('extracts type, scope and text', () => {
    expect(parseConventional('feat(virtual-list): glide rows')).toEqual({
      type: 'feat',
      scope: 'virtual-list',
      breaking: false,
      text: 'glide rows',
    });
    expect(parseConventional('nonconforming subject')).toBeNull();
  });

  it('maps types to Keep-a-Changelog sections', () => {
    expect(sectionOf(parseConventional('feat: x'))).toBe('added');
    expect(sectionOf(parseConventional('fix: x'))).toBe('fixed');
    expect(sectionOf(parseConventional('refactor: x'))).toBe('changed');
    expect(sectionOf(parseConventional('feat!: x'))).toBe('breaking');
    expect(sectionOf(parseConventional('docs: x'))).toBeNull();
    expect(sectionOf(parseConventional('chore: x'))).toBeNull();
  });
});

describe('semver helpers', () => {
  it('parses and bumps', () => {
    expect(parseVer('1.2.3')).toEqual([1, 2, 3]);
    expect(bump([0, 3, 1], 'minor')).toEqual([0, 4, 0]);
    expect(bump([0, 3, 1], 'major')).toEqual([1, 0, 0]);
    expect(bump([0, 3, 1], 'patch')).toEqual([0, 3, 2]);
  });
});

describe('stripMd', () => {
  it('flattens links, bold and code', () => {
    expect(stripMd('**`FuzzyList`** — see [docs](https://x.y) for `smooth`')).toBe(
      'FuzzyList — see docs for smooth',
    );
  });
});

const MD = `# Changelog

Intro prose.

## [Unreleased]

## [0.2.0] - 2026-07-14

> Panels everywhere

### Added

- **\`Collection\`** — cards ⇄ list toggle. Needs a stable
  key, as ever; off by default.
- Windowed card grids via \`columns\`.
  - FuzzyList forwards it.

### Fixed

- Drawer reopened at minSize instead of its defaultSize.

## [0.1.0] - 2026-07-13

### Changed

- Converge prop names on \`on<X>Change\`.

[0.2.0]: https://example.com/compare/v0.1.0...v0.2.0
[0.1.0]: https://example.com/releases/v0.1.0
`;

describe('parseKeepAChangelog', () => {
  const entries = parseKeepAChangelog(MD);

  it('finds all headings including [Unreleased]', () => {
    expect(entries.map((e) => e.version)).toEqual(['unreleased', '0.2.0', '0.1.0']);
    expect(entries[1].date).toBe('2026-07-14');
  });

  it('captures the > title blockquote', () => {
    expect(entries[1].title).toBe('Panels everywhere');
  });

  it('groups bullets into sections, joining wrapped lines and nesting', () => {
    const e = entries[1];
    expect(e.sections.added).toHaveLength(3); // 2 top-level + 1 nested
    expect(e.sections.added[0]).toBe(
      'Collection — cards ⇄ list toggle. Needs a stable key, as ever; off by default.',
    );
    expect(e.sections.added[2]).toBe('FuzzyList forwards it.');
    expect(e.sections.fixed).toEqual(['Drawer reopened at minSize instead of its defaultSize.']);
    expect(e.changes).toHaveLength(4);
  });

  it('does not swallow the link-reference lines at the bottom', () => {
    const last = entries[2];
    expect(last.sections.changed).toEqual(['Converge prop names on on<X>Change.']);
  });
});

describe('draftUnreleased', () => {
  const rows = [
    { sha: 'aaaaaaa1111', date: '2026-07-14', subject: 'feat(list): new smooth mode' },
    { sha: 'bbbbbbb2222', date: '2026-07-14', subject: 'fix: stuck scroll' },
    { sha: 'ccccccc3333', date: '2026-07-14', subject: 'docs: readme tweak' },
  ];

  it('groups new commits under [Unreleased] sections with short shas', () => {
    const { md, added, skipped } = draftUnreleased(MD, rows);
    expect(added).toBe(2);
    expect(skipped).toBe(1); // docs commit dropped
    expect(md).toContain('### Added\n\n- **list**: new smooth mode (aaaaaaa)');
    expect(md).toContain('### Fixed\n\n- stuck scroll (bbbbbbb)');
    // Released sections untouched.
    expect(md).toContain('Drawer reopened at minSize');
  });

  it('is idempotent — already-cited shas are skipped', () => {
    const first = draftUnreleased(MD, rows).md;
    const second = draftUnreleased(first, rows);
    expect(second.added).toBe(0);
    expect(second.md).toBe(first);
  });
});
