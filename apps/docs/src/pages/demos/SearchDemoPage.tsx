import { useState } from 'react';
import { Boxes, FolderGit2, Play, Server, Zap } from 'lucide-react';
import { Badge, FuzzyList, GlobalSearch, RelativeTime, useToast, type Tone } from '@gabvdl/ui';

import { nodes } from '../../data';
import { DemoShell } from './DemoShell';

/*
 * Switchboard — one palette over the whole lab. GlobalSearch is the ⌘K face,
 * FuzzyList the browsable body; both search the same index, both fully
 * keyboard-driven (arrows / Enter / Escape) and fully thumb-driven (the
 * palette is a bottom sheet on phones, the list rows are 44px targets).
 */

interface Entry {
  name: string;
  kind: 'service' | 'project' | 'box' | 'action';
  host: string;
  desc: string;
}

const ACTIONS: Entry[] = [
  { name: 'wake the GPU box', kind: 'action', host: 'evox2', desc: 'send Wake-on-LAN to the Strix Halo, wait for Tailscale' },
  { name: 'deploy the docs', kind: 'action', host: 'ui.gabvdl.xyz', desc: 'build @gabvdl/docs and rsync it to the edge' },
  { name: 'publish @gabvdl/ui', kind: 'action', host: 'verdaccio', desc: 'bump, build and push a dev cut to the private registry' },
  { name: 'rotate the backups', kind: 'action', host: 'restic', desc: 'run the nightly restic snapshot to Drive now' },
];

const INDEX: Entry[] = [...ACTIONS, ...nodes];

const KIND_TONE: Record<Entry['kind'], Tone> = {
  action: 'sky',
  service: 'emerald',
  project: 'violet',
  box: 'amber',
};

const KIND_ICON = {
  action: Zap,
  service: Server,
  project: FolderGit2,
  box: Boxes,
} as const;

export function SearchDemoPage() {
  const toast = useToast();
  const [ran, setRan] = useState<{ entry: Entry; at: number }[]>([]);

  const run = (entry: Entry) => {
    setRan((r) => [{ entry, at: Date.now() }, ...r].slice(0, 6));
    toast.success(entry.kind === 'action' ? `Ran “${entry.name}”` : `Opened ${entry.name}`, {
      title: entry.host,
    });
  };

  return (
    <DemoShell name="Switchboard" proves="GlobalSearch · FuzzyList · Badge · Toast">
      <div className="h-full overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col px-4 py-8 sm:py-14">
          <p className="eyebrow mb-3">Everything, one keystroke away</p>
          <h1 className="display text-2xl leading-tight text-foreground sm:text-3xl">
            Services, projects, boxes, actions.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            The bar below is a <span className="mono text-xs">GlobalSearch</span> trigger — press{' '}
            <kbd className="mono rounded border border-border px-1.5 py-0.5 text-[11px]">⌘K</kbd> anywhere on
            this page, or tap it. On a phone the palette opens as a bottom sheet over the keyboard.
          </p>

          <div className="mt-6">
            <GlobalSearch
              items={INDEX}
              keys={['name', 'desc', 'host', 'kind']}
              titleKey="name"
              descriptionKey="desc"
              badgeKey="kind"
              getItemKey={(e) => `${e.kind}:${e.name}`}
              onSelect={run}
              trigger="bar"
              triggerLabel="Search the lab…"
              placeholder="Type a service, a box, an action…"
            />
          </div>

          {ran.length > 0 && (
            <div className="mt-6">
              <p className="eyebrow mb-2">Recent</p>
              <ul className="space-y-1.5">
                {ran.map(({ entry, at }, i) => (
                  <li key={`${entry.name}-${at}`} className={i === 0 ? 'demo-msg-in' : undefined}>
                    <span className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="inline-flex min-w-0 items-center gap-2">
                        <Play className="size-3 shrink-0 text-muted-foreground" />
                        <span className="truncate text-foreground">{entry.name}</span>
                        <Badge tone={KIND_TONE[entry.kind]}>{entry.kind}</Badge>
                      </span>
                      <RelativeTime date={at} className="shrink-0 text-[11px] text-muted-foreground" />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-10 border-t border-border pt-8">
            <p className="eyebrow mb-2">Or browse it</p>
            <p className="mb-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
              The same index through <span className="mono text-xs">FuzzyList</span> — inline, no overlay.
              Matches highlight as you type, arrow keys walk the rows, Enter runs one.
            </p>
            <FuzzyList
              items={INDEX}
              keys={['name', 'desc', 'host', 'kind']}
              getItemKey={(e) => `${e.kind}:${e.name}`}
              onSelect={run}
              placeholder="Filter the lab…"
              showCount
              smooth
              estimateSize={64}
              listClassName="max-h-[26rem]"
              renderItem={({ item, active, highlight, select }) => {
                const Icon = KIND_ICON[item.kind];
                return (
                  <button
                    type="button"
                    onClick={select}
                    className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                      active ? 'border-[color:var(--cyan)]/50 bg-muted/70' : 'border-transparent hover:bg-muted/50'
                    }`}
                  >
                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-foreground">{highlight('name')}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {highlight('desc', { snippet: true })}
                      </span>
                    </span>
                    <span className="mono hidden shrink-0 text-[11px] text-muted-foreground sm:inline">{item.host}</span>
                    <Badge tone={KIND_TONE[item.kind]}>{item.kind}</Badge>
                  </button>
                );
              }}
            />
          </div>
        </div>
      </div>
    </DemoShell>
  );
}
