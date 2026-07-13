import { useRef, useState, type ReactNode } from 'react';
import {
  Bell,
  BookOpen,
  GitBranch,
  GitCommit,
  Rocket,
  FlaskConical,
  Server,
  Sparkles,
  Tag as TagIcon,
} from 'lucide-react';
import {
  Button,
  RichInput,
  type GuidelineTag,
  type RichFile,
  type RichInputHandle,
  type RichSendPayload,
} from '@gabvdl/ui';

/* ── shared bits ─────────────────────────────────────────────────────────── */
function Section({
  n,
  title,
  children,
  code,
  aside,
}: {
  n: number;
  title: string;
  children: ReactNode;
  code?: string;
  aside?: ReactNode;
}) {
  return (
    <section className="border-t border-border py-10 first:border-t-0">
      <div className="mb-4 flex items-baseline gap-3">
        <span className="mono text-[11px] text-[color:var(--cyan-deep)]">{String(n).padStart(2, '0')}</span>
        <h2 className="display text-xl text-foreground">{title}</h2>
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
        <div className="min-w-0">{children}</div>
        <div className="min-w-0 space-y-3">
          {aside}
          {code && <Code code={code} />}
        </div>
      </div>
    </section>
  );
}

function Code({ code }: { code: string }) {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-[var(--surface)]">
      <pre className="overflow-x-auto p-3.5 text-[0.72rem] leading-relaxed">
        <code className="mono text-foreground">{code}</code>
      </pre>
    </div>
  );
}

function Lede({ children }: { children: ReactNode }) {
  return <p className="mb-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">{children}</p>;
}

function Readout({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-[var(--surface)] p-3">
      <div className="eyebrow mb-2 text-[color:var(--cyan-deep)]">{label}</div>
      {children}
    </div>
  );
}

/* ── demo data ───────────────────────────────────────────────────────────── */
const GUIDELINE_TAGS: GuidelineTag[] = [
  {
    id: 'worktree',
    label: 'Worktree',
    labelOff: 'On main',
    icon: <GitBranch className="size-3" />,
    prompt: 'Work in an isolated git worktree.',
    promptOff: 'Work directly on the main branch.',
    defaultOn: true,
  },
  { id: 'tests', label: 'Add tests', icon: <FlaskConical className="size-3" />, prompt: 'Add unit tests for the change.' },
  {
    id: 'commit',
    label: 'Commit & push',
    icon: <GitCommit className="size-3" />,
    prompt: 'Commit and push when done.',
    defaultOn: true,
  },
  { id: 'deploy', label: 'Deploy', icon: <Rocket className="size-3" />, prompt: 'Deploy once it works.' },
  { id: 'docs', label: 'Docs', icon: <BookOpen className="size-3" />, prompt: 'Update the documentation.' },
  {
    id: 'notify',
    label: 'Notify',
    icon: <Bell className="size-3" />,
    prompt: 'Send a push notification when finished.',
    defaultOn: true,
  },
];

// Location tags (`group: 'tag'`) render in a scrollable list, not the guideline
// row, and are never dimmed by the guidelines master switch.
const LOCATION_TAGS: GuidelineTag[] = [
  { id: 'svc-ai-agent', slug: 'ai-agent', group: 'tag', label: 'ai-agent', icon: <Server className="size-3 text-sky-500" />, description: 'conversation viewer' },
  { id: 'svc-traefik', slug: 'traefik', group: 'tag', label: 'traefik', icon: <Server className="size-3 text-sky-500" />, description: 'reverse proxy' },
  { id: 'svc-authelia', slug: 'authelia', group: 'tag', label: 'authelia', icon: <Server className="size-3 text-sky-500" />, description: 'forward-auth' },
  { id: 'svc-pihole', slug: 'pihole', group: 'tag', label: 'pihole', icon: <Server className="size-3 text-sky-500" />, description: 'ad-blocker' },
  { id: 'svc-grafana', slug: 'grafana', group: 'tag', label: 'grafana', icon: <Server className="size-3 text-sky-500" />, description: 'dashboards' },
  { id: 'svc-loki', slug: 'loki', group: 'tag', label: 'loki', icon: <Server className="size-3 text-sky-500" />, description: 'log store' },
  { id: 'prj-design-system', slug: 'design-system', group: 'tag', label: 'design-system', icon: <TagIcon className="size-3 text-primary" />, description: '@gabvdl/ui library' },
  { id: 'prj-gabvdl', slug: 'gabvdl', group: 'tag', label: 'gabvdl', icon: <TagIcon className="size-3 text-primary" />, description: 'personal sites' },
  { id: 'prj-zine-maker', slug: 'zine-maker', group: 'tag', label: 'zine-maker', icon: <TagIcon className="size-3 text-primary" />, description: 'mini-zine maker' },
  { id: 'prj-moooo', slug: 'moooo', group: 'tag', label: 'moooo', icon: <TagIcon className="size-3 text-primary" />, description: 'party game' },
];

// Toggle guidelines + search-only mention tags (projects), all reachable via `#`.
const MENTION_TAGS: GuidelineTag[] = [
  ...GUIDELINE_TAGS,
  { id: 'p-ai-agent', slug: 'ai-agent', kind: 'mention', label: 'ai-agent', description: 'conversation viewer', prompt: 'Touch services/ai-agent.' },
  { id: 'p-design-system', slug: 'design-system', kind: 'mention', label: 'design-system', description: '@gabvdl/ui library', prompt: 'Touch projects/design-system.' },
  { id: 'p-traefik', slug: 'traefik', kind: 'mention', label: 'traefik', description: 'reverse proxy', prompt: 'Touch services/traefik.' },
  { id: 'p-pihole', slug: 'pihole', kind: 'mention', label: 'pihole', description: 'ad-blocker', prompt: 'Touch services/pihole.' },
  { id: 'p-authelia', slug: 'authelia', kind: 'mention', label: 'authelia', description: 'forward-auth', prompt: 'Touch services/authelia.' },
];

/* ── page ────────────────────────────────────────────────────────────────── */
export function RichInputPage() {
  return (
    <div className="mx-auto max-w-4xl px-5 pb-24">
      <div className="py-8">
        <p className="eyebrow mb-2 text-[color:var(--cyan-deep)]">shadcn · composer</p>
        <h1 className="display text-3xl text-foreground">RichInput</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          A batteries-included composer, factored out of the ai-agent conversation viewer. A
          plain textarea grows into: a persisted draft, a 3-second un-send window, multi-file
          upload, toggle-able guideline tags, <span className="mono text-foreground">#</span>-mention
          search, and a shell-style command history. Each capability below is independent — pass
          only the props you need.
        </p>
      </div>

      <UnsendDemo />
      <DraftDemo />
      <FilesDemo />
      <GuidelinesDemo />
      <TagListDemo />
      <MentionDemo />
      <HistoryDemo />
      <ImperativeDemo />
    </div>
  );
}

/* 01 — basics + un-send (forwardRef) */
function UnsendDemo() {
  const [sent, setSent] = useState<string[]>([]);
  return (
    <Section
      n={1}
      title="Un-send window"
      code={`<RichInput
  undoWindowMs={3000}
  onSubmit={(p) => send(p.text)}
/>`}
      aside={
        <Readout label="delivered">
          {sent.length === 0 ? (
            <p className="text-xs text-muted-foreground">nothing yet — send, then race the 3s timer</p>
          ) : (
            <ul className="space-y-1.5">
              {sent.map((s, i) => (
                <li key={i} className="truncate text-xs text-foreground">
                  <span className="mono text-[color:var(--cyan-deep)]">→</span> {s}
                </li>
              ))}
            </ul>
          )}
        </Readout>
      }
    >
      <Lede>
        On submit the message is held for 3 seconds behind a "tap to un-send" banner — the{' '}
        <span className="mono text-foreground">onSubmit</span> only fires once the countdown
        elapses. The imperative <span className="mono text-foreground">cancelSend()</span> (exposed
        via <span className="mono text-foreground">forwardRef</span>) restores the exact text, files
        and tags. Press <span className="mono text-foreground">Enter</span> to send,{' '}
        <span className="mono text-foreground">Shift+Enter</span> for a newline.
      </Lede>
      <RichInput
        placeholder="Say something, then hit Enter…"
        onSubmit={(p) => setSent((prev) => [p.text, ...prev].slice(0, 6))}
      />
    </Section>
  );
}

/* 02 — draft cache */
function DraftDemo() {
  return (
    <Section
      n={2}
      title="Local-storage draft"
      code={`<RichInput
  cacheKey="demo-draft"
  cacheLocation="local"
/>`}
    >
      <Lede>
        With a <span className="mono text-foreground">cacheKey</span> the draft is mirrored into{' '}
        <span className="mono text-foreground">localStorage</span> (debounced) and restored on
        mount — type below, reload the page, and it's still here. The same key also namespaces the
        command history. Use <span className="mono text-foreground">cacheLocation="session"</span>{' '}
        to scope it to the tab instead.
      </Lede>
      <RichInput cacheKey="ds-richinput-draft" placeholder="Type, then reload the page…" undoWindowMs={0} />
    </Section>
  );
}

/* 03 — files */
function FilesDemo() {
  const [last, setLast] = useState<RichFile[]>([]);
  return (
    <Section
      n={3}
      title="File upload"
      code={`<RichInput
  accept="image/*,.pdf"
  maxFiles={4}
  // fileDrop      — on by default
  // uploadFiles={uploadToServer}
  onSubmit={(p) => post(p.text, p.files)}
/>`}
      aside={
        <Readout label="last attachments">
          {last.length === 0 ? (
            <p className="text-xs text-muted-foreground">attach a few, then send</p>
          ) : (
            <ul className="space-y-1 text-xs text-foreground">
              {last.map((f) => (
                <li key={f.id} className="truncate">
                  {f.name} <span className="text-muted-foreground">· {f.contentType}</span>
                </li>
              ))}
            </ul>
          )}
        </Readout>
      }
    >
      <Lede>
        Attach many at once, images preview as thumbnails, each chip removes independently.{' '}
        <span className="mono text-foreground">accept</span> and{' '}
        <span className="mono text-foreground">maxFiles</span> filter the picks (try a 5th file, or a
        non-image); a <span className="mono text-foreground">fileFilter</span> callback can reject
        with a reason. Pass <span className="mono text-foreground">uploadFiles</span> to POST to a
        server — omitted here, so files stay client-side as object URLs. You can also paste an image,
        or <strong className="text-foreground">drop files (and whole folders) anywhere on the box</strong>{' '}
        — dropped files go through the very same checks. Turn that off with{' '}
        <span className="mono text-foreground">fileDrop={'{false}'}</span>; dragged <em>text</em> still
        drops into the textarea.
      </Lede>
      <RichInput
        accept="image/*,.pdf"
        maxFiles={4}
        undoWindowMs={0}
        placeholder="Attach up to 4 images or PDFs — or drop them here…"
        onSubmit={(p) => setLast(p.files)}
      />
    </Section>
  );
}

/* 04 — guidelines */
function GuidelinesDemo() {
  const [prompt, setPrompt] = useState<string | null>(null);
  return (
    <Section
      n={4}
      title="Guideline tags"
      code={`const tags = [
  { id: 'worktree', label: 'Worktree',
    labelOff: 'On main', defaultOn: true,
    prompt: 'Work in a worktree.',
    promptOff: 'Work on main.' },
  { id: 'deploy', label: 'Deploy',
    prompt: 'Deploy once it works.' },
  // …
]

<RichInput tags={tags} showMax={4} />`}
      aside={
        <Readout label="composed prompt">
          {prompt ? (
            <pre className="whitespace-pre-wrap text-[11px] leading-relaxed text-foreground">{prompt}</pre>
          ) : (
            <p className="text-xs text-muted-foreground">toggle chips, then send to see the weave</p>
          )}
        </Readout>
      }
    >
      <Lede>
        Toggle-able chips that map to injected prompt lines. Each tag carries the exact text it adds
        (and an optional <span className="mono text-foreground">promptOff</span> for either/or
        toggles like Worktree ⇄ On main) — no prompt-injection guesswork. With{' '}
        <span className="mono text-foreground">showMax=4</span> the overflow collapses behind a
        "+N more" button. The final string is assembled by{' '}
        <span className="mono text-foreground">composePrompt</span> and handed to{' '}
        <span className="mono text-foreground">onSubmit</span>.
      </Lede>
      <RichInput
        tags={GUIDELINE_TAGS}
        showMax={4}
        undoWindowMs={0}
        placeholder="Describe a task, flip some guidelines…"
        onSubmit={(p) => setPrompt(p.prompt)}
      />
    </Section>
  );
}

/* 05 — guidelines master switch + scrollable tag list */
function TagListDemo() {
  const [prompt, setPrompt] = useState<string | null>(null);
  const [glOn, setGlOn] = useState(true);
  return (
    <Section
      n={5}
      title="Guidelines switch & tag list"
      code={`const tags = [
  // guideline chips (default group)…
  { id: 'worktree', label: 'Worktree', prompt: '…' },
  // location chips → scrollable list
  { id: 'svc-traefik', slug: 'traefik',
    group: 'tag', label: 'traefik' },
  // …
]

<RichInput
  tags={tags}
  guidelinesToggle          // on/off master switch
  defaultGuidelinesOn
  onGuidelinesToggle={setGlOn}
  tagListRows={3}           // scroll after 3 rows
/>`}
      aside={
        <>
          <Readout label="guidelines">
            <p className="text-xs text-foreground">
              master switch is <span className="mono text-[color:var(--cyan-deep)]">{glOn ? 'on' : 'off'}</span>
              {glOn ? ' — lines are woven in' : ' — sent as typed'}
            </p>
          </Readout>
          <Readout label="composed prompt">
            {prompt ? (
              <pre className="whitespace-pre-wrap text-[11px] leading-relaxed text-foreground">{prompt}</pre>
            ) : (
              <p className="text-xs text-muted-foreground">flip the switch, toggle a location, then send</p>
            )}
          </Readout>
        </>
      }
    >
      <Lede>
        Two clusters. Guideline chips sit under a{' '}
        <span className="mono text-foreground">guidelinesToggle</span> master switch — flip it off and
        the guideline lines are dropped from the composed prompt (sent as typed) and the chip row
        hides, while <span className="mono text-foreground">group: 'tag'</span> chips (project/service
        locations) stay put in their own scrollable list, capped at{' '}
        <span className="mono text-foreground">tagListRows</span> rows before it scrolls.
      </Lede>
      <RichInput
        tags={[...GUIDELINE_TAGS, ...LOCATION_TAGS]}
        guidelinesToggle
        onGuidelinesToggle={setGlOn}
        tagListRows={3}
        showMax={4}
        undoWindowMs={0}
        placeholder="Toggle guidelines, pick a location…"
        onSubmit={(p) => setPrompt(p.prompt)}
      />
    </Section>
  );
}

/* 06 — mention */
function MentionDemo() {
  const [prompt, setPrompt] = useState<string | null>(null);
  return (
    <Section
      n={6}
      title="Mention search"
      code={`<RichInput
  tags={tags}          // toggles + kind:'mention'
  mentionPrefix="#"
  onSubmit={(p) => run(p.prompt)}
/>`}
      aside={
        <Readout label="composed prompt">
          {prompt ? (
            <pre className="whitespace-pre-wrap text-[11px] leading-relaxed text-foreground">{prompt}</pre>
          ) : (
            <p className="text-xs text-muted-foreground">
              type <span className="mono text-foreground">#</span> to search — try{' '}
              <span className="mono text-foreground">#pi</span> or <span className="mono text-foreground">#trae</span>
            </p>
          )}
        </Readout>
      }
    >
      <Lede>
        Type the prefix (<span className="mono text-foreground">#</span> by default, configurable)
        to open a live autocomplete over the tags — including search-only{' '}
        <span className="mono text-foreground">kind: 'mention'</span> tags that never appear as
        chips. Arrow keys navigate, Enter/Tab inserts, Escape dismisses; picking one also flips its
        guideline on. This is the "show more" path when there are more tags than fit as chips.
      </Lede>
      <RichInput
        tags={MENTION_TAGS}
        showMax={4}
        mentionPrefix="#"
        undoWindowMs={0}
        placeholder="Mention a project with #…"
        onSubmit={(p) => setPrompt(p.prompt)}
      />
    </Section>
  );
}

/* 07 — history */
function HistoryDemo() {
  // Seed a few entries synchronously (before the child mounts) so the demo is
  // explorable immediately.
  useState(() => {
    const key = 'rich-input:history:ds-richinput-history';
    try {
      if (!localStorage.getItem(key)) {
        localStorage.setItem(
          key,
          JSON.stringify([
            'deploy the staging stack',
            'rebuild the search index',
            'restart traefik',
            'run the nightly backup',
            'bump @gabvdl/ui to 0.3.0',
          ]),
        );
      }
    } catch {
      /* ignore */
    }
    return true;
  });
  return (
    <Section
      n={6}
      title="Command history"
      code={`<RichInput
  cacheKey="demo"   // namespaces history
  history           // on by default
/>

// ↑ recall · ↓ forward
// Ctrl+R reverse-search
// mobile: the ⟲ history icon`}
    >
      <Lede>
        A shell-style history, persisted per <span className="mono text-foreground">cacheKey</span>.
        Submitted (and cleared) values are pushed in; press{' '}
        <span className="mono text-foreground">↑</span> at the start of an empty field to walk
        backwards, <span className="mono text-foreground">↓</span> to come back.{' '}
        <span className="mono text-foreground">Ctrl+R</span> opens an incremental reverse-search —
        keep pressing it to cycle matches, Enter to accept. On touch devices the{' '}
        <span className="mono text-foreground">⟲</span> icon opens a virtualized sheet of past
        commands. This field is pre-seeded with five — try <span className="mono text-foreground">Ctrl+R</span>{' '}
        then "trae".
      </Lede>
      <RichInput cacheKey="ds-richinput-history" undoWindowMs={0} placeholder="↑ for history · Ctrl+R to search…" />
    </Section>
  );
}

/* 08 — imperative handle */
function ImperativeDemo() {
  const ref = useRef<RichInputHandle>(null);
  const [log, setLog] = useState<string[]>([]);
  const note = (s: string) => setLog((p) => [s, ...p].slice(0, 5));
  const onSubmit = (p: RichSendPayload) => note(`onSubmit → "${p.text}"`);
  return (
    <Section
      n={7}
      title="Imperative handle (forwardRef)"
      code={`const ref = useRef<RichInputHandle>(null)

<RichInput ref={ref} onSubmit={…} />

ref.current.focus()
ref.current.setValue('hello')
ref.current.submit()
ref.current.cancelSend()  // un-send
ref.current.clear()`}
      aside={
        <Readout label="calls">
          {log.length === 0 ? (
            <p className="text-xs text-muted-foreground">drive the input with the buttons</p>
          ) : (
            <ul className="space-y-1 text-xs text-foreground">
              {log.map((l, i) => (
                <li key={i} className="mono truncate">
                  {l}
                </li>
              ))}
            </ul>
          )}
        </Readout>
      }
    >
      <Lede>
        The component forwards a ref exposing{' '}
        <span className="mono text-foreground">focus / blur / getValue / setValue / submit /
        cancelSend / clear</span>. Handy for slash-command palettes, "insert template" buttons, or a
        global send hotkey.
      </Lede>
      <RichInput ref={ref} undoWindowMs={3000} placeholder="Driven from the buttons →" onSubmit={onSubmit} />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => { ref.current?.focus(); note('focus()'); }}>
          <Sparkles className="size-3.5" /> Focus
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => { ref.current?.setValue('Ship the release and notify the team'); note('setValue(…)'); }}
        >
          Insert template
        </Button>
        <Button size="sm" variant="outline" onClick={() => { ref.current?.submit(); note('submit()'); }}>
          Submit
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => { const r = ref.current?.cancelSend(); note(r ? 'cancelSend() → restored' : 'cancelSend() → nothing pending'); }}
        >
          Un-send
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { ref.current?.clear(); note('clear()'); }}>
          Clear
        </Button>
      </div>
    </Section>
  );
}
