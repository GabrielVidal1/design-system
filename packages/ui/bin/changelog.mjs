#!/usr/bin/env node
// gabvdl-changelog — generate a JSONL changelog (read by @gabvdl/ui's
// Changelog / ChangelogPage / useChangelog) from a repo's history.
//
// Three modes:
//
//   gabvdl-changelog [build]            Fully automatic: conventional commits
//                                       → public/changelog.jsonl. First run
//                                       seeds one version per commit (0.1.0
//                                       up); later runs bundle every commit
//                                       since the last recorded sha into ONE
//                                       new version, bumped by the strongest
//                                       change among them. Run at deploy time.
//
//   gabvdl-changelog from-md [FILE]     Curated: parse a Keep-a-Changelog
//                                       CHANGELOG.md (## [x.y.z] - date, ###
//                                       Added/Changed/… sections) into the
//                                       same JSONL, with sections preserved.
//                                       For published packages whose changelog
//                                       is hand-edited. A `> title` blockquote
//                                       directly under a version heading
//                                       becomes the entry's title.
//
//   gabvdl-changelog draft [FILE]       Draft the [Unreleased] section of
//                                       CHANGELOG.md from conventional commits
//                                       since the last release heading (tag
//                                       v<version> when it exists, else the
//                                       commit that introduced the heading).
//                                       Idempotent: commits already listed (by
//                                       short sha) are skipped. Curate the
//                                       prose, then release.
//
// Conventional-commit bump levels: "!"/BREAKING → major, feat → minor, else
// patch. Zero dependencies; requires git in PATH.
//
// Options:
//   --out <path>    JSONL output (build/from-md). Default: public/changelog.jsonl
//   --dist <dir>    Also mirror the JSONL there when the dir exists. Default: dist
//   --cwd <dir>     Repo/package directory to operate in. Default: .
//   --dry-run       Print what would change without writing.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/* ── conventional commits ────────────────────────────────────────────────── */

const CONVENTIONAL_RE = /^(\w+)(\([^)]*\))?(!)?:\s*(.*)$/;
const RANK = { patch: 0, minor: 1, major: 2 };

/** Bump level for a commit subject: major | minor | patch. */
export function conventionalLevel(subject) {
  if (subject.includes('BREAKING CHANGE')) return 'major';
  const m = CONVENTIONAL_RE.exec(subject);
  if (m) {
    if (m[3]) return 'major';
    if (m[1] === 'feat') return 'minor';
  }
  return 'patch';
}

/** Parse a conventional subject into {type, scope, breaking, text}, or null. */
export function parseConventional(subject) {
  const m = CONVENTIONAL_RE.exec(subject);
  if (!m) return null;
  return {
    type: m[1],
    scope: m[2] ? m[2].slice(1, -1) : null,
    breaking: Boolean(m[3]) || subject.includes('BREAKING CHANGE'),
    text: m[4].trim(),
  };
}

/** Keep-a-Changelog section for a conventional commit, or null to skip. */
export function sectionOf(parsed) {
  if (!parsed) return null;
  if (parsed.breaking) return 'breaking';
  switch (parsed.type) {
    case 'feat':
      return 'added';
    case 'fix':
      return 'fixed';
    case 'perf':
    case 'refactor':
      return 'changed';
    case 'revert':
      return 'changed';
    default:
      return null; // docs, chore, ci, test, style, build, release…
  }
}

/* ── semver ──────────────────────────────────────────────────────────────── */

export function parseVer(v) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(v ?? '');
  return m ? [+m[1], +m[2], +m[3]] : [0, 0, 0];
}

export function bump(ver, lvl) {
  const [M, m, p] = ver;
  if (lvl === 'major') return [M + 1, 0, 0];
  if (lvl === 'minor') return [M, m + 1, 0];
  return [M, m, p + 1];
}

const vstr = (v) => v.join('.');

/* ── markdown helpers ────────────────────────────────────────────────────── */

/** Light markdown → plain text: links, bold/italic, inline code. */
export function stripMd(text) {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

const SECTION_KEYS = ['breaking', 'added', 'changed', 'deprecated', 'removed', 'fixed', 'security'];
const SECTION_TITLE = {
  breaking: 'Breaking',
  added: 'Added',
  changed: 'Changed',
  deprecated: 'Deprecated',
  removed: 'Removed',
  fixed: 'Fixed',
  security: 'Security',
};

/**
 * Parse a Keep-a-Changelog document into entries:
 * [{version, date?, title?, sections, changes}] in file order (newest first in
 * a conventional file). [Unreleased] is returned with version 'unreleased' so
 * callers can decide; from-md drops it.
 */
export function parseKeepAChangelog(md) {
  const lines = md.split('\n');
  const entries = [];
  let entry = null;
  let section = null;
  let bullets = null; // items array of the current section
  let lastBulletIndent = 0;

  const flushEntry = () => {
    if (!entry) return;
    entry.changes = SECTION_KEYS.flatMap((k) => entry.sections[k] ?? []);
    for (const k of SECTION_KEYS) {
      if (entry.sections[k] && entry.sections[k].length === 0) delete entry.sections[k];
    }
    if (Object.keys(entry.sections).length === 0) delete entry.sections;
    entries.push(entry);
    entry = null;
    section = null;
    bullets = null;
  };

  for (const raw of lines) {
    const heading = /^##\s+\[([^\]]+)\](?:\s*-\s*(\S+))?/.exec(raw);
    if (heading) {
      flushEntry();
      const label = heading[1].trim();
      entry = {
        version: /unreleased/i.test(label) ? 'unreleased' : label,
        date: heading[2],
        sections: {},
      };
      continue;
    }
    if (!entry) continue;

    const sub = /^###\s+(.+)$/.exec(raw);
    if (sub) {
      const key = sub[1].trim().toLowerCase();
      section = SECTION_KEYS.includes(key) ? key : null;
      if (section) {
        entry.sections[section] ??= [];
        bullets = entry.sections[section];
      } else {
        bullets = null;
      }
      continue;
    }

    const title = /^>\s+(.+)$/.exec(raw);
    if (title && !entry.title && !section) {
      entry.title = stripMd(title[1]);
      continue;
    }

    const bullet = /^(\s*)-\s+(.+)$/.exec(raw);
    if (bullet && bullets) {
      // Nested bullets become their own change lines.
      bullets.push(stripMd(bullet[2]));
      lastBulletIndent = bullet[1].length;
      continue;
    }

    // Continuation of a wrapped bullet: indented text under the last item.
    if (bullets && bullets.length > 0 && /^\s{2,}\S/.test(raw) && raw.trim() !== '') {
      const cont = stripMd(raw);
      if (cont && !/^\[[^\]]+\]:/.test(cont)) {
        bullets[bullets.length - 1] += ` ${cont}`;
      }
      continue;
    }
    void lastBulletIndent;
  }
  flushEntry();
  return entries;
}

/* ── git plumbing ────────────────────────────────────────────────────────── */

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' });
}

function tryGit(cwd, ...args) {
  try {
    return git(cwd, ...args);
  } catch {
    return null;
  }
}

/** Commits as [{sha, date, subject}], newest first (git log order). */
function commits(cwd, range) {
  const args = ['log', '--no-merges', '--date=short', '--format=%H%x1f%ad%x1f%s'];
  if (range) args.push(range);
  const out = tryGit(cwd, ...args);
  if (out === null) return null;
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [sha, date, subject] = line.split('\x1f');
      return { sha, date, subject };
    })
    .filter((c) => c.subject !== undefined);
}

/* ── JSONL ───────────────────────────────────────────────────────────────── */

function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  const out = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try {
      out.push(JSON.parse(t));
    } catch {
      /* tolerate a bad line rather than crash */
    }
  }
  return out;
}

function writeJsonl(file, entries, { dryRun, distDir }) {
  const text = entries.map((e) => JSON.stringify(e)).join('\n') + '\n';
  if (dryRun) {
    process.stdout.write(text);
    return;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  // Mirror into an already-built dist/ so the current deploy ships the update.
  if (distDir && fs.existsSync(distDir)) {
    fs.copyFileSync(file, path.join(distDir, path.basename(file)));
  }
}

/* ── build: fully automatic, git → jsonl ─────────────────────────────────── */

function warnUnconventional(rows) {
  for (const c of rows) {
    if (!CONVENTIONAL_RE.test(c.subject)) {
      console.warn(`  (not conventional, counted as patch: "${c.subject}")`);
    }
  }
}

/** Seed entries from a full history (oldest→newest), one version per commit. */
export function seedEntries(rows) {
  const entries = [];
  let prev = null;
  for (const c of rows) {
    const ver = prev === null ? [0, 1, 0] : bump(prev, conventionalLevel(c.subject));
    prev = ver;
    entries.push({
      version: vstr(ver),
      date: c.date,
      title: c.subject,
      changes: [c.subject],
      sha: c.sha,
    });
  }
  return entries;
}

function cmdBuild(opts) {
  const file = path.resolve(opts.cwd, opts.out);
  const existing = readJsonl(file);

  if (existing.length === 0) {
    const rows = commits(opts.cwd);
    if (rows === null) {
      console.error('gabvdl-changelog: not a git repo, skipping');
      return;
    }
    rows.reverse(); // oldest → newest
    if (rows.length === 0) {
      console.log('gabvdl-changelog: no commits yet, nothing to seed');
      return;
    }
    warnUnconventional(rows);
    const entries = seedEntries(rows);
    writeJsonl(file, entries, opts);
    console.log(
      `gabvdl-changelog: seeded ${entries.length} versions (${entries[0].version} → ${entries[entries.length - 1].version})`,
    );
    return;
  }

  // Incremental: bundle commits since the last recorded sha into one version.
  const top = existing.reduce((a, b) => {
    const [aM, am, ap] = parseVer(a.version);
    const [bM, bm, bp] = parseVer(b.version);
    if (bM !== aM) return bM > aM ? b : a;
    if (bm !== am) return bm > am ? b : a;
    return bp > ap ? b : a;
  });
  const rows = top.sha ? commits(opts.cwd, `${top.sha}..HEAD`) : null;
  if (!rows || rows.length === 0) {
    console.log('gabvdl-changelog: no new commits since last version, unchanged');
    return;
  }
  rows.reverse();
  warnUnconventional(rows);
  const lvl = rows
    .map((c) => conventionalLevel(c.subject))
    .reduce((a, b) => (RANK[b] > RANK[a] ? b : a), 'patch');
  const newVer = bump(parseVer(top.version), lvl);
  const head = rows[rows.length - 1];
  existing.push({
    version: vstr(newVer),
    date: head.date,
    title: rows.length === 1 ? rows[0].subject : `${rows.length} updates`,
    changes: rows.map((c) => c.subject),
    sha: head.sha,
  });
  writeJsonl(file, existing, opts);
  console.log(`gabvdl-changelog: added v${vstr(newVer)} (${lvl}) with ${rows.length} change(s)`);
}

/* ── from-md: curated CHANGELOG.md → jsonl ───────────────────────────────── */

function cmdFromMd(opts) {
  const mdFile = path.resolve(opts.cwd, opts.file ?? 'CHANGELOG.md');
  if (!fs.existsSync(mdFile)) {
    console.error(`gabvdl-changelog: ${mdFile} not found`);
    process.exitCode = 1;
    return;
  }
  const parsed = parseKeepAChangelog(fs.readFileSync(mdFile, 'utf8'));
  const entries = parsed.filter((e) => e.version !== 'unreleased' && e.changes.length > 0);
  if (entries.length === 0) {
    console.log('gabvdl-changelog: no released versions found in the changelog');
    return;
  }
  const file = path.resolve(opts.cwd, opts.out);
  writeJsonl(file, entries, opts);
  console.log(
    `gabvdl-changelog: wrote ${entries.length} versions (${entries[entries.length - 1].version} → ${entries[0].version}) to ${path.relative(opts.cwd, file)}`,
  );
}

/* ── draft: conventional commits → [Unreleased] ──────────────────────────── */

export function draftUnreleased(md, rows) {
  // Skip commits already cited (by short sha) anywhere in the document's
  // Unreleased block, and release/meta commits.
  const unreleasedEnd = (() => {
    const start = md.search(/^##\s+\[Unreleased\]/im);
    if (start === -1) return null;
    const rest = md.slice(start + 1);
    const next = rest.search(/^##\s+\[/m);
    return { start, end: next === -1 ? md.length : start + 1 + next };
  })();
  if (!unreleasedEnd) return { md, added: 0, skipped: rows.length };

  const block = md.slice(unreleasedEnd.start, unreleasedEnd.end);
  const grouped = {};
  let added = 0;
  let skipped = 0;
  for (const c of rows) {
    const short = c.sha.slice(0, 7);
    if (block.includes(short)) {
      skipped++;
      continue;
    }
    const parsed = parseConventional(c.subject);
    const section = sectionOf(parsed);
    if (!section) {
      skipped++;
      continue;
    }
    const scope = parsed.scope ? `**${parsed.scope}**: ` : '';
    (grouped[section] ??= []).push(`- ${scope}${parsed.text} (${short})`);
    added++;
  }
  if (added === 0) return { md, added, skipped };

  let newBlock = block.trimEnd();
  for (const key of SECTION_KEYS) {
    const items = grouped[key];
    if (!items) continue;
    const title = `### ${SECTION_TITLE[key]}`;
    const at = newBlock.indexOf(title);
    if (at !== -1) {
      // Append to the existing section (right after its heading).
      const insertAt = at + title.length;
      newBlock = `${newBlock.slice(0, insertAt)}\n\n${items.join('\n')}${newBlock.slice(insertAt)}`;
    } else {
      newBlock += `\n\n${title}\n\n${items.join('\n')}`;
    }
  }
  newBlock += '\n\n';
  return {
    md: md.slice(0, unreleasedEnd.start) + newBlock + md.slice(unreleasedEnd.end),
    added,
    skipped,
  };
}

function cmdDraft(opts) {
  const mdFile = path.resolve(opts.cwd, opts.file ?? 'CHANGELOG.md');
  if (!fs.existsSync(mdFile)) {
    console.error(`gabvdl-changelog: ${mdFile} not found`);
    process.exitCode = 1;
    return;
  }
  const md = fs.readFileSync(mdFile, 'utf8');
  const released = parseKeepAChangelog(md).find((e) => e.version !== 'unreleased');

  let range;
  if (released) {
    // Boundary: the release tag when it exists, else the commit that
    // introduced the version heading into the changelog.
    const tag = tryGit(opts.cwd, 'rev-parse', '--verify', '--quiet', `v${released.version}^{commit}`);
    let boundary = tag?.trim();
    if (!boundary) {
      const introduced = tryGit(
        opts.cwd,
        'log',
        '-n1',
        '--format=%H',
        '-S',
        `[${released.version}]`,
        '--',
        path.relative(opts.cwd, mdFile) || 'CHANGELOG.md',
      );
      boundary = introduced?.trim().split('\n')[0];
    }
    if (!boundary) {
      console.error(
        `gabvdl-changelog: could not locate the release commit for ${released.version} — pass commits manually or tag v${released.version}`,
      );
      process.exitCode = 1;
      return;
    }
    range = `${boundary}..HEAD`;
  }

  const rows = commits(opts.cwd, range);
  if (rows === null) {
    console.error('gabvdl-changelog: not a git repo');
    process.exitCode = 1;
    return;
  }
  rows.reverse();
  const { md: next, added, skipped } = draftUnreleased(md, rows);
  if (added === 0) {
    console.log(`gabvdl-changelog: nothing to draft (${skipped} commit(s) skipped or already listed)`);
    return;
  }
  if (opts.dryRun) {
    process.stdout.write(next);
  } else {
    fs.writeFileSync(mdFile, next);
  }
  console.log(
    `gabvdl-changelog: drafted ${added} change(s) into [Unreleased] (${skipped} skipped) — curate the prose before releasing`,
  );
}

/* ── entrypoint ──────────────────────────────────────────────────────────── */

function parseArgs(argv) {
  const opts = {
    cmd: 'build',
    out: path.join('public', 'changelog.jsonl'),
    distDir: 'dist',
    cwd: process.cwd(),
    dryRun: false,
    file: undefined,
  };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') opts.out = argv[++i];
    else if (a === '--dist') opts.distDir = argv[++i];
    else if (a === '--cwd') opts.cwd = path.resolve(argv[++i]);
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--help' || a === '-h') opts.cmd = 'help';
    else positional.push(a);
  }
  if (positional.length > 0 && ['build', 'from-md', 'draft'].includes(positional[0])) {
    opts.cmd = positional.shift();
  }
  opts.file = positional[0];
  if (opts.distDir) opts.distDir = path.resolve(opts.cwd, opts.distDir);
  return opts;
}

const HELP = `gabvdl-changelog — JSONL changelog generator for @gabvdl/ui

Usage:
  gabvdl-changelog [build]          git history → public/changelog.jsonl (auto-versioned)
  gabvdl-changelog from-md [FILE]   Keep-a-Changelog CHANGELOG.md → public/changelog.jsonl
  gabvdl-changelog draft [FILE]     draft [Unreleased] in CHANGELOG.md from new commits

Options:
  --out <path>   JSONL output path (default: public/changelog.jsonl)
  --dist <dir>   mirror the JSONL there when it exists (default: dist)
  --cwd <dir>    directory to operate in (default: .)
  --dry-run      print instead of writing
`;

export function main(argv = process.argv.slice(2)) {
  const opts = parseArgs(argv);
  if (opts.cmd === 'help') {
    process.stdout.write(HELP);
    return;
  }
  if (opts.cmd === 'from-md') cmdFromMd(opts);
  else if (opts.cmd === 'draft') cmdDraft(opts);
  else cmdBuild(opts);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
