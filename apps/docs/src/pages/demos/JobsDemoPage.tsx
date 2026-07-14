import { useEffect, useMemo, useRef, useState } from 'react';
import { Cpu, ListX, Plus, X } from 'lucide-react';
import {
  Button,
  DataTable,
  EmptyState,
  Progress,
  ProgressiveBash,
  RelativeTime,
  ResizableLayout,
  StatRow,
  StatTile,
  StatusBadge,
  fmtDuration,
  type BashEntry,
  type DataTableColumn,
} from '@gabvdl/ui';

import { DemoShell } from './DemoShell';

/*
 * Render queue — a 3d-gen-style service frontend. One GPU, so one job runs at
 * a time (the true shape of the lab's queue); everything else waits its turn.
 * KPI strip up top, the live queue as a DataTable, and each job's logs
 * replayed by ProgressiveBash in the detail panel.
 */

type Status = 'queued' | 'running' | 'done' | 'failed';

interface Job {
  id: string;
  name: string;
  kind: 'image→3d' | 'auto-rig' | 'thumbnail';
  status: Status;
  progress: number;
  created: number;
  started?: number;
  finished?: number;
  logs: BashEntry[];
}

/** Log lines revealed as a job's progress crosses each stage. */
const STAGES: { at: number; entry: (j: Job) => Omit<BashEntry, 'id' | 'timestamp'> }[] = [
  {
    at: 0,
    entry: (j) => ({
      command: `wol wake evox2 && curl -s evox2:8001/health`,
      output: `{"status":"ok","gpu":"gfx1151","vram_free":"91.2 GiB"}`,
      description: `wake the GPU box for ${j.name}`,
    }),
  },
  {
    at: 18,
    entry: (j) => ({
      command: `trellis2 load --pipeline 512`,
      output: `loading TRELLIS.2 … sdpa whitelist patched\npipeline ready in 11.3s`,
      description: `${j.kind} — load the pipeline`,
    }),
  },
  {
    at: 45,
    entry: (j) => ({
      command: `trellis2 run ${j.name}.png`,
      output: `diffusion 37.2s · cumesh ok · flex_gemm ok`,
    }),
  },
  {
    at: 78,
    entry: () => ({
      command: `to_glb --decimate 100000 --texture 2048`,
      output: `UV unwrap 7.1s · texture bake 12.4s`,
    }),
  },
  {
    at: 100,
    entry: (j) => ({
      command: `cp out/model.glb /data/3d/${j.name}.glb && notify-done "✅ ${j.name}"`,
      output: `pushed to gallery · notified`,
      exitCode: 0,
    }),
  },
];

const FAIL_ENTRY = (j: Job): Omit<BashEntry, 'id' | 'timestamp'> => ({
  command: `trellis2 run ${j.name}.png`,
  output: `HIP out of memory — two GPU workloads at once crash the box\njob aborted, GPU released`,
  isError: true,
  exitCode: 1,
});

const NAMES = [
  'clay-fox',
  'brass-astrolabe',
  'moss-golem',
  'paper-crane',
  'tide-chart',
  'oak-gall',
  'walnut-knight',
  'kiln-brick',
  'wren-skull',
  'glass-buoy',
];
const KINDS: Job['kind'][] = ['image→3d', 'auto-rig', 'thumbnail'];

let seq = 0;
const newJob = (created: number, status: Status = 'queued'): Job => ({
  id: `job-${++seq}`,
  name: NAMES[seq % NAMES.length],
  kind: KINDS[seq % KINDS.length],
  status,
  progress: 0,
  created,
  logs: [],
});

/** Backfill a finished job (history rows) with its full log, pre-played. */
const finishedJob = (minsAgo: number, failed = false): Job => {
  const created = Date.now() - minsAgo * 60_000;
  const j = newJob(created, failed ? 'failed' : 'done');
  j.started = created + 20_000;
  j.finished = j.started + (40 + (seq % 90)) * 1000;
  j.progress = failed ? 62 : 100;
  const stages = failed ? STAGES.slice(0, 2) : STAGES;
  j.logs = stages.map((s, i) => ({
    id: `${j.id}-s${i}`,
    timestamp: j.started! + i * 9_000,
    ...s.entry(j),
  }));
  if (failed) j.logs.push({ id: `${j.id}-fail`, timestamp: j.finished, ...FAIL_ENTRY(j) });
  return j;
};

const seedJobs = (): Job[] => [
  finishedJob(46),
  finishedJob(31),
  finishedJob(19, true),
  finishedJob(8),
  { ...newJob(Date.now() - 60_000, 'running'), started: Date.now() - 45_000, progress: 12 },
  newJob(Date.now() - 20_000),
  newJob(Date.now() - 5_000),
];

export function JobsDemoPage() {
  const [jobs, setJobs] = useState<Job[]>(seedJobs);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const mounted = useRef(Date.now());

  /* The scheduler: one GPU, one running job. Advance it, log its stage
   * transitions, finish it (a slice fail), then start the next queued job. */
  useEffect(() => {
    const tick = setInterval(() => {
      setJobs((js) => {
        const next = js.map((j) => ({ ...j, logs: j.logs }));
        const running = next.find((j) => j.status === 'running');
        if (running) {
          const before = running.progress;
          running.progress = Math.min(100, before + 4 + Math.random() * 9);
          for (const s of STAGES) {
            if (before < s.at && running.progress >= s.at) {
              running.logs = [
                ...running.logs,
                { id: `${running.id}-s${s.at}`, timestamp: Date.now(), ...s.entry(running) },
              ];
            }
          }
          if (running.progress >= 100) {
            running.status = 'done';
            running.finished = Date.now();
          } else if (running.progress > 55 && Math.random() < 0.03) {
            running.status = 'failed';
            running.finished = Date.now();
            running.logs = [...running.logs, { id: `${running.id}-fail`, timestamp: Date.now(), ...FAIL_ENTRY(running) }];
          }
        } else {
          const queued = next
            .filter((j) => j.status === 'queued')
            .sort((a, b) => a.created - b.created)[0];
          if (queued) {
            queued.status = 'running';
            queued.started = Date.now();
            queued.progress = 0;
          }
        }
        return next;
      });
    }, 1100);
    return () => clearInterval(tick);
  }, []);

  const selected = jobs.find((j) => j.id === selectedId) ?? null;

  const doneCount = jobs.filter((j) => j.status === 'done').length;
  const failCount = jobs.filter((j) => j.status === 'failed').length;
  const queueDepth = jobs.filter((j) => j.status === 'queued' || j.status === 'running').length;
  const gpuMs = jobs.reduce((s, j) => {
    if (!j.started) return s;
    return s + ((j.finished ?? Date.now()) - j.started);
  }, 0);

  const columns: DataTableColumn<Job>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Job',
        sortable: true,
        cell: (j) => (
          <span className="block min-w-0">
            <span className="mono block truncate text-xs text-foreground">{j.name}</span>
            <span className="text-[11px] text-muted-foreground">{j.kind}</span>
          </span>
        ),
      },
      { key: 'status', header: 'Status', cell: (j) => <StatusBadge status={j.status} /> },
      {
        key: 'progress',
        header: 'Progress',
        width: '26%',
        cell: (j) =>
          j.status === 'running' ? (
            <Progress value={j.progress} size="xs" />
          ) : j.status === 'queued' ? (
            <span className="text-xs text-muted-foreground">waiting for the GPU</span>
          ) : (
            <Progress value={100} size="xs" tone={j.status === 'done' ? 'emerald' : 'rose'} animate={false} />
          ),
      },
      {
        key: 'created',
        header: 'Created',
        sortable: true,
        hideOnMobile: true,
        cell: (j) => <RelativeTime date={j.created} className="text-xs text-muted-foreground" />,
      },
      {
        key: 'took',
        header: 'Took',
        sortable: true,
        align: 'right',
        sortValue: (j) => (j.started && j.finished ? j.finished - j.started : null),
        cell: (j) =>
          j.started && j.finished ? (
            <span className="mono text-xs">{fmtDuration(j.finished - j.started)}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
    ],
    [],
  );

  const openJob = (j: Job) => {
    setSelectedId(j.id);
    setDetailOpen(true);
  };

  const detail = (
    <div className="flex h-full flex-col">
      <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
        {selected ? (
          <>
            <span className="mono min-w-0 truncate text-sm text-foreground">{selected.name}</span>
            <span className="flex items-center gap-1.5">
              <StatusBadge status={selected.status} />
              <button
                type="button"
                aria-label="Close job detail"
                onClick={() => setDetailOpen(false)}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </span>
          </>
        ) : (
          <span className="eyebrow">Job detail</span>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {selected ? (
          <div className="space-y-4">
            {selected.status === 'running' && (
              <Progress value={selected.progress} label={`${selected.kind} on evox2`} showValue />
            )}
            <dl className="space-y-1.5 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">Created</dt>
                <dd>
                  <RelativeTime date={selected.created} className="mono text-xs" />
                </dd>
              </div>
              {selected.started && (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground">GPU time</dt>
                  <dd className="mono text-xs">
                    {fmtDuration((selected.finished ?? Date.now()) - selected.started)}
                  </dd>
                </div>
              )}
            </dl>
            <div>
              <p className="eyebrow mb-2">Logs</p>
              <ProgressiveBash
                entries={selected.logs}
                catchUp={mounted.current}
                stickyPrompt
                className="max-h-[50dvh]"
              />
            </div>
          </div>
        ) : (
          <EmptyState
            icon={<Cpu />}
            title="No job selected"
            description="Pick a row in the queue and its logs replay here."
          />
        )}
      </div>
    </div>
  );

  return (
    <DemoShell name="Render queue" proves="StatTile · DataTable · Progress · ProgressiveBash">
      <ResizableLayout
        autoSaveId="demo-jobs"
        right={{ content: detail, defaultSize: 34, mobileMode: 'drawer', mobileWidth: '92%' }}
        rightOpen={detailOpen}
        onRightOpenChange={setDetailOpen}
      >
        <div className="h-full overflow-y-auto">
          <div className="mx-auto max-w-4xl px-3 py-5 sm:px-5">
            <StatRow columns={4}>
              <StatTile label="Done today" value={doneCount} delta={12} hint={`${jobs.length} total`} />
              <StatTile
                label="Queue"
                value={queueDepth}
                hint="one GPU, one job at a time"
                Icon={Cpu}
              />
              <StatTile label="GPU time" value={fmtDuration(gpuMs)} hint="EVOX2 · gfx1151" />
              <StatTile label="Failures" value={failCount} delta={-25} goodDirection="down" hint="vs yesterday" />
            </StatRow>

            <div className="mt-6 mb-3 flex items-center justify-between gap-3">
              <h2 className="display text-lg text-foreground">Queue</h2>
              <Button
                size="sm"
                onClick={() => setJobs((js) => [...js, newJob(Date.now())])}
              >
                <Plus /> Queue a job
              </Button>
            </div>

            <DataTable
              data={jobs}
              columns={columns}
              getRowKey={(j) => j.id}
              onRowClick={openJob}
              defaultSort={{ key: 'created', dir: 'desc' }}
              rowClassName={(j) => (j.id === selectedId ? 'bg-muted/50' : undefined)}
              empty={
                <EmptyState
                  icon={<ListX />}
                  title="Queue is empty"
                  description="Queue a job and watch it run."
                  action={
                    <Button size="sm" onClick={() => setJobs((js) => [...js, newJob(Date.now())])}>
                      <Plus /> Queue a job
                    </Button>
                  }
                />
              }
            />
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Live simulation of the lab's real single-GPU queue: jobs advance one at a time, the
              occasional out-of-memory failure included. Click a row for its logs; sort by any header;
              on a phone the rows collapse into cards.
            </p>
          </div>
        </div>
      </ResizableLayout>
    </DemoShell>
  );
}
