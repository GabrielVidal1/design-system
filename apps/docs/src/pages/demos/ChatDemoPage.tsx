import { useEffect, useRef, useState } from 'react';
import { Bot, GitCommitHorizontal, PanelLeft, PanelRight, Rocket, TestTubeDiagonal } from 'lucide-react';
import {
  Badge,
  ProgressiveText,
  RelativeTime,
  ResizableLayout,
  RichInput,
  StatusBadge,
  cn,
  fmtCost,
  fmtNum,
  useIsMobile,
  type GuidelineTag,
  type RichSendPayload,
} from '@gabvdl/ui';

import { DemoShell } from './DemoShell';

/*
 * Agent console — the ai-agent screen rebuilt from the library alone.
 * Left drawer: conversations. Right drawer: the run's receipts. Center: the
 * transcript (assistant turns stream in with ProgressiveText) over a RichInput
 * composer whose guideline chips are the lab's actual house rules.
 */

interface Msg {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  at: number;
  /** Only the newest assistant turn streams; history renders instantly. */
  live?: boolean;
}

interface Convo {
  id: string;
  title: string;
  status: string;
  at: number;
  messages: Msg[];
}

const now = Date.now();
const M = (id: string, role: Msg['role'], minsAgo: number, text: string): Msg => ({
  id,
  role,
  text,
  at: now - minsAgo * 60_000,
});

const CONVOS: Convo[] = [
  {
    id: 'pihole',
    title: 'Deploy Pi-hole behind CoreDNS',
    status: 'running',
    at: now - 2 * 60_000,
    messages: [
      M('p1', 'user', 26, 'Chain Pi-hole behind CoreDNS so the LAN gets ad-blocking without touching host :53.'),
      M(
        'p2',
        'assistant',
        25,
        'Plan: a dns-net bridge with a fixed subnet so CoreDNS can forward to a stable address, Pi-hole at 172.30.53.2, and CoreDNS policy sequential so the chain fails over cleanly.\n\nCreating services/pihole/docker-compose.yml on profile dns…',
      ),
      M('p3', 'user', 8, 'Looks right — bring it up and run the smoke test.'),
      M(
        'p4',
        'assistant',
        2,
        'Stack is up. dig through CoreDNS resolves and ads.example.com returns 0.0.0.0 from the blocklist. Writing the homepage tile now, then I\'ll commit the service in its own focused commit.',
      ),
    ],
  },
  {
    id: 'worktree',
    title: 'Fix worktree node_modules copy',
    status: 'done',
    at: now - 3 * 3_600_000,
    messages: [
      M('w1', 'user', 200, 'npm ci fails inside new worktrees — deps are missing for nested packages.'),
      M(
        'w2',
        'assistant',
        195,
        'Root cause: new-worktree.sh only copied the top-level node_modules, so monorepo workspaces started empty. Fixed by hardlink-copying every nested node_modules with cp -al — isolated trees, near-zero extra disk.',
      ),
      M('w3', 'user', 185, 'Merged. Nice.'),
    ],
  },
  {
    id: 'og',
    title: 'Batch og:image refresh',
    status: 'queued',
    at: now - 26 * 3_600_000,
    messages: [
      M('o1', 'user', 1560, 'Refresh the og:images for every deployed site once the new screenshot skill lands.'),
    ],
  },
];

/** Scripted replies the fake agent cycles through on each send. */
const REPLIES = [
  'On it. Spinning up an isolated worktree first — house rule — then I\'ll make the change there and run the checks before anything touches main.',
  'Done. Typecheck and tests are green, and the diff is three focused commits instead of one blob. Deploying next, then you\'ll get the push notification.',
  'Deployed and verified end-to-end — the page renders, the API answers, and the logs are quiet. Anything else while the context is warm?',
];

const TAGS: GuidelineTag[] = [
  {
    id: 'worktree',
    label: 'isolated worktree',
    prompt: 'Work in an isolated git worktree, never on main.',
    defaultOn: true,
    icon: <GitCommitHorizontal className="size-3.5" />,
  },
  {
    id: 'tests',
    label: 'tests first',
    prompt: 'Run typecheck and tests before calling anything done.',
    defaultOn: true,
    icon: <TestTubeDiagonal className="size-3.5" />,
  },
  {
    id: 'deploy',
    label: 'deploy when green',
    prompt: 'Deploy once checks pass, then send the push notification.',
    icon: <Rocket className="size-3.5" />,
  },
  { id: 'pihole', label: 'services/pihole', kind: 'mention', group: 'tag', description: 'the DNS stack' },
  { id: 'ui', label: 'projects/design-system', kind: 'mention', group: 'tag', description: 'this library' },
];

export function ChatDemoPage() {
  const isMobile = useIsMobile();
  const [convos, setConvos] = useState(CONVOS);
  const [activeId, setActiveId] = useState('pihole');
  const [leftOpen, setLeftOpen] = useState(!isMobile);
  const [rightOpen, setRightOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const replyCursor = useRef(0);
  const scroller = useRef<HTMLDivElement>(null);

  const active = convos.find((c) => c.id === activeId) ?? convos[0];

  const scrollToEnd = () => {
    requestAnimationFrame(() => {
      scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
    });
  };
  useEffect(scrollToEnd, [activeId, active.messages.length]);

  const append = (convoId: string, msg: Msg, status?: string) =>
    setConvos((cs) =>
      cs.map((c) =>
        c.id === convoId
          ? { ...c, at: msg.at, status: status ?? c.status, messages: [...c.messages, msg] }
          : c,
      ),
    );

  const send = (payload: RichSendPayload) => {
    const at = Date.now();
    append(activeId, { id: `u${at}`, role: 'user', text: payload.text, at }, 'running');
    setBusy(true);
    const convoId = activeId;
    setTimeout(() => {
      const text = REPLIES[replyCursor.current++ % REPLIES.length];
      append(convoId, { id: `a${Date.now()}`, role: 'assistant', text, at: Date.now(), live: true });
      setBusy(false);
    }, 900);
  };

  const conversationList = (
    <div className="flex h-full flex-col">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="eyebrow">Conversations</span>
        <span className="mono text-[11px] tabular-nums text-muted-foreground">{convos.length}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {convos.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              setActiveId(c.id);
              if (isMobile) setLeftOpen(false);
            }}
            className={cn(
              'mb-1 block w-full rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors hover:bg-muted/60',
              c.id === active.id && 'border-border bg-muted/60',
            )}
          >
            <span className="block truncate text-sm text-foreground">{c.title}</span>
            <span className="mt-1.5 flex items-center gap-2">
              <StatusBadge status={c.status} />
              <RelativeTime date={c.at} className="text-[11px] text-muted-foreground" />
            </span>
          </button>
        ))}
      </div>
    </div>
  );

  const runDetails = (
    <div className="flex h-full flex-col">
      <div className="flex h-11 shrink-0 items-center border-b border-border px-3">
        <span className="eyebrow">Run details</span>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        <dl className="space-y-2 text-sm">
          {(
            [
              ['Model', 'claude-fable-5'],
              ['Turns', String(active.messages.length)],
              ['Tokens', fmtNum(184_320 + active.messages.length * 4_112)],
              ['Cost', fmtCost(0.42 + active.messages.length * 0.03)],
            ] as const
          ).map(([k, val]) => (
            <div key={k} className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="mono text-xs text-foreground">{val}</dd>
            </div>
          ))}
        </dl>
        <div>
          <p className="eyebrow mb-2">Checks</p>
          <div className="flex flex-wrap gap-1.5">
            <StatusBadge status="done" meta={{ done: { label: 'worktree', tone: 'emerald' } }} />
            <StatusBadge status="done" meta={{ done: { label: 'commit ×3', tone: 'emerald' } }} />
            <StatusBadge status={active.status === 'done' ? 'done' : 'running'} meta={{
              done: { label: 'deploy', tone: 'emerald' },
              running: { label: 'deploy', tone: 'sky' },
            }} />
          </div>
        </div>
        <div>
          <p className="eyebrow mb-2">Files touched</p>
          <ul className="space-y-1">
            {['services/pihole/docker-compose.yml', 'services/pihole/traefik.yml', 'docker-compose.yml'].map((f) => (
              <li key={f} className="mono truncate text-[11px] text-muted-foreground">
                {f}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );

  return (
    <DemoShell name="Agent console" proves="ResizableLayout · RichInput · ProgressiveText · StatusBadge">
      <ResizableLayout
        autoSaveId="demo-chat"
        left={{ content: conversationList, defaultSize: 22, mobileMode: 'drawer', edgeSwipeToOpen: true }}
        right={{ content: runDetails, defaultSize: 24, mobileMode: 'drawer' }}
        leftOpen={leftOpen}
        onLeftOpenChange={setLeftOpen}
        rightOpen={rightOpen}
        onRightOpenChange={setRightOpen}
      >
        <div className="flex h-full min-h-0 flex-col">
          {/* the conversation's own header row */}
          <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-2 sm:px-4">
            <button
              type="button"
              aria-label="Toggle conversations"
              onClick={() => setLeftOpen((o) => !o)}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <PanelLeft className="size-4" />
            </button>
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{active.title}</span>
            <StatusBadge status={busy ? 'running' : active.status} />
            <button
              type="button"
              aria-label="Toggle run details"
              onClick={() => setRightOpen((o) => !o)}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <PanelRight className="size-4" />
            </button>
          </div>

          {/* transcript */}
          <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5">
            <div className="mx-auto flex max-w-2xl flex-col gap-4">
              {active.messages.map((m) =>
                m.role === 'user' ? (
                  <div key={m.id} className="demo-msg-in self-end">
                    <div className="max-w-[46ch] rounded-2xl rounded-br-md bg-[color:var(--cyan)]/12 px-4 py-2.5 text-sm leading-relaxed text-foreground">
                      {m.text}
                    </div>
                    <RelativeTime date={m.at} className="mt-1 block text-right text-[10px] text-muted-foreground" />
                  </div>
                ) : (
                  <div key={m.id} className="demo-msg-in flex max-w-[56ch] gap-2.5 self-start">
                    <span className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground">
                      <Bot className="size-3.5" />
                    </span>
                    <div className="min-w-0">
                      <ProgressiveText
                        text={m.text}
                        as="div"
                        instant={!m.live}
                        speed={220}
                        onUpdate={scrollToEnd}
                        className="whitespace-pre-wrap text-sm leading-relaxed text-foreground"
                      />
                      <RelativeTime date={m.at} className="mt-1 block text-[10px] text-muted-foreground" />
                    </div>
                  </div>
                ),
              )}
              {busy && (
                <div className="demo-msg-in flex items-center gap-2.5 self-start">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground">
                    <Bot className="size-3.5" />
                  </span>
                  <Badge tone="sky" dot>
                    thinking
                  </Badge>
                </div>
              )}
            </div>
          </div>

          {/* composer */}
          <div className="shrink-0 border-t border-border p-2 sm:p-3">
            <div className="mx-auto max-w-2xl">
              <RichInput
                placeholder="Ask the agent — # mentions a location…"
                tags={TAGS}
                guidelinesToggle
                onSubmit={send}
                undoWindowMs={2000}
                cacheKey={`demo-chat-${active.id}`}
                minRows={1}
                maxRows={8}
              />
            </div>
          </div>
        </div>
      </ResizableLayout>
    </DemoShell>
  );
}
