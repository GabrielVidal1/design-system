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
  Wrench,
  Tag as TagIcon,
} from 'lucide-react';
import {
  Button,
  RichInput,
  type RichTag,
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
// Tags are just labelled ids — what they *mean* lives on this side of the
// component, in the caller's own table and its `composePrompt`.
const CHIP_TAGS: RichTag[] = [
  {
    id: 'worktree',
    label: 'Worktree',
    labelOff: 'On main',
    icon: <GitBranch className="size-3" />,
    defaultOn: true,
  },
  { id: 'tests', label: 'Add tests', icon: <FlaskConical className="size-3" /> },
  { id: 'commit', label: 'Commit & push', icon: <GitCommit className="size-3" />, defaultOn: true },
  { id: 'deploy', label: 'Deploy', icon: <Rocket className="size-3" /> },
  { id: 'docs', label: 'Docs', icon: <BookOpen className="size-3" /> },
  { id: 'notify', label: 'Notify', icon: <Bell className="size-3" />, defaultOn: true },
];

/** The caller's own id → line table (on/off variants where it has two states). */
const GUIDELINE_LINES: Record<string, { on: string; off?: string }> = {
  worktree: { on: 'Work in an isolated git worktree.', off: 'Work directly on the main branch.' },
  tests: { on: 'Add unit tests for the change.' },
  commit: { on: 'Commit and push when done.' },
  deploy: { on: 'Deploy once it works.' },
  docs: { on: 'Update the documentation.' },
  notify: { on: 'Send a push notification when finished.' },
  'deploy-smoke': { on: 'Smoke-test the deployed URL before reporting done.' },
  'deploy-rollback': { on: 'Note the rollback command in the summary.' },
};

/** Weave the selected tags into a prompt — the composer never does this itself. */
function weave(text: string, tags: RichTag[]): string {
  const lines = tags.map((t) => GUIDELINE_LINES[t.id]?.on).filter(Boolean);
  return lines.length > 0 ? [text, '', 'Guidelines:', ...lines.map((l) => `- ${l}`)].join('\n') : text;
}

// Location tags (`group: 'list'`) render in a scrollable list, not the chip
// row, and are never muted by the master switch.
const LOCATION_TAGS: RichTag[] = [
  { id: 'svc-ai-agent', slug: 'ai-agent', group: 'list', label: 'ai-agent', icon: <Server className="size-3 text-sky-500" />, description: 'conversation viewer' },
  { id: 'svc-traefik', slug: 'traefik', group: 'list', label: 'traefik', icon: <Server className="size-3 text-sky-500" />, description: 'reverse proxy' },
  { id: 'svc-authelia', slug: 'authelia', group: 'list', label: 'authelia', icon: <Server className="size-3 text-sky-500" />, description: 'forward-auth' },
  { id: 'svc-pihole', slug: 'pihole', group: 'list', label: 'pihole', icon: <Server className="size-3 text-sky-500" />, description: 'ad-blocker' },
  { id: 'svc-grafana', slug: 'grafana', group: 'list', label: 'grafana', icon: <Server className="size-3 text-sky-500" />, description: 'dashboards' },
  { id: 'svc-loki', slug: 'loki', group: 'list', label: 'loki', icon: <Server className="size-3 text-sky-500" />, description: 'log store' },
  { id: 'prj-design-system', slug: 'design-system', group: 'list', label: 'design-system', icon: <TagIcon className="size-3 text-primary" />, description: '@gabvdl/ui library' },
  { id: 'prj-gabvdl', slug: 'gabvdl', group: 'list', label: 'gabvdl', icon: <TagIcon className="size-3 text-primary" />, description: 'personal sites' },
  { id: 'prj-zine-maker', slug: 'zine-maker', group: 'list', label: 'zine-maker', icon: <TagIcon className="size-3 text-primary" />, description: 'mini-zine maker' },
  { id: 'prj-moooo', slug: 'moooo', group: 'list', label: 'moooo', icon: <TagIcon className="size-3 text-primary" />, description: 'party game' },
];

// Toggle chips + search-only mention tags (projects), all reachable via `#`.
const MENTION_TAGS: RichTag[] = [
  ...CHIP_TAGS,
  { id: 'p-ai-agent', slug: 'ai-agent', kind: 'mention', label: 'ai-agent', description: 'conversation viewer' },
  { id: 'p-design-system', slug: 'design-system', kind: 'mention', label: 'design-system', description: '@gabvdl/ui library' },
  { id: 'p-traefik', slug: 'traefik', kind: 'mention', label: 'traefik', description: 'reverse proxy' },
  { id: 'p-pihole', slug: 'pihole', kind: 'mention', label: 'pihole', description: 'ad-blocker' },
  { id: 'p-authelia', slug: 'authelia', kind: 'mention', label: 'authelia', description: 'forward-auth' },
];

// Auto-tag tags carry the words that should surface them, and the colour their
// ring and accepted mark are drawn in. Everything else about them is ordinary.
const AUTO_TAGS: RichTag[] = [
  {
    id: 'skill:screenshot',
    slug: 'screenshot',
    group: 'list',
    label: 'screenshot',
    icon: <Wrench className="size-3 text-sky-500" />,
    color: 'var(--color-sky-500)',
    description: 'capture a live URL',
    triggers: ['screenshot', 'take a screenshot', 'capture'],
  },
  {
    id: 'skill:nanobanana',
    slug: 'nanobanana',
    group: 'list',
    label: 'nanobanana',
    icon: <Wrench className="size-3 text-amber-500" />,
    color: 'var(--color-amber-500)',
    description: 'generate or edit an image',
    triggers: ['nanobanana', 'generate an image', 'image of'],
  },
  {
    id: 'skill:image-to-3d',
    slug: 'image-to-3d',
    group: 'list',
    label: 'image-to-3d',
    icon: <Wrench className="size-3 text-violet-500" />,
    color: 'var(--color-violet-500)',
    description: 'image → textured .glb',
    triggers: ['image-to-3d', '3d model', '3d mesh', 'glb'],
  },
  {
    id: 'skill:open-pr',
    slug: 'open-pr',
    group: 'list',
    label: 'open-pr',
    icon: <Wrench className="size-3 text-emerald-500" />,
    color: 'var(--color-emerald-500)',
    description: 'open a documented PR',
    triggers: ['open-pr', 'open a pr', 'pull request'],
  },
  {
    id: 'prj-design-system-auto',
    slug: 'design-system',
    group: 'list',
    label: 'design-system',
    icon: <TagIcon className="size-3 text-primary" />,
    color: 'var(--color-primary)',
    description: '@gabvdl/ui library',
    triggers: ['design-system', 'design system'],
  },
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
          plain textarea grows into: a persisted draft, a saved-drafts shelf, a 3-second un-send
          window, multi-file upload, toggle-able tags,{' '}
          <span className="mono text-foreground">#</span>-mention search, and a shell-style command
          history. Each capability below is independent — pass only the props you need.
        </p>
      </div>

      <UnsendDemo />
      <DraftDemo />
      <DraftsShelfDemo />
      <FilesDemo />
      <GuidelinesDemo />
      <TagListDemo />
      <NestedTagsDemo />
      <MentionDemo />
      <AutoTagDemo />
      <HistoryDemo />
      <ImperativeDemo />
      <ToolbarReorderDemo />
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

/* 03 — saved drafts shelf */
function DraftsShelfDemo() {
  return (
    <Section
      n={3}
      title="Saved drafts"
      code={`<RichInput
  cacheKey="demo"
  // drafts       — on by default
  draftExtra={() => ({ model })}
  onDraftRestore={(x) => setModel(x.model)}
/>`}
    >
      <Lede>
        <strong className="text-foreground">Hold (or right-click) the send button</strong> to save
        the message as a draft instead of sending — the text, the selected tags, the
        attachments and an optional <span className="mono text-foreground">draftExtra</span> payload
        (a model pick living outside the composer, say) are stored in localStorage and the composer
        clears. While drafts exist a <em>drafts</em> button with a count badge sits right of send;
        it opens a fuzzy-search dropdown of past drafts. Picking one restores it —{' '}
        <em>swapping</em>: anything currently typed is stashed as a draft first, so nothing is ever
        lost. Rows delete via the trash icon.
      </Lede>
      <RichInput
        cacheKey="ds-richinput-drafts"
        tags={CHIP_TAGS}
        showMax={4}
        undoWindowMs={0}
        placeholder="Type, then hold the send button…"
      />
    </Section>
  );
}

/* 04 — files */
function FilesDemo() {
  const [last, setLast] = useState<RichFile[]>([]);
  return (
    <Section
      n={4}
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

/* 05 — toggle tags */
function GuidelinesDemo() {
  const [prompt, setPrompt] = useState<string | null>(null);
  return (
    <Section
      n={5}
      title="Toggle tags"
      code={`const tags = [
  { id: 'worktree', label: 'Worktree',
    labelOff: 'On main', defaultOn: true },
  { id: 'deploy', label: 'Deploy' },
  // …
]

// meaning lives in YOUR code, not the composer
<RichInput
  tags={tags}
  showMax={4}
  composePrompt={({ text, tags }) =>
    [text, ...tags.map(t => LINES[t.id])].join('\\n')}
/>`}
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
        Toggle-able chips. A tag is only an id, a label and an optional{' '}
        <span className="mono text-foreground">labelOff</span> for either/or toggles (Worktree ⇄ On
        main) — it carries no text of its own. The composer tracks <em>which</em> tags are on and
        hands them to your <span className="mono text-foreground">composePrompt</span>; whatever
        they mean — a guideline line, a model, a target — is resolved in your code. Without a{' '}
        <span className="mono text-foreground">composePrompt</span> the prompt is just the typed
        text. With <span className="mono text-foreground">showMax=4</span> the overflow collapses
        behind a "+N more" button.
      </Lede>
      <RichInput
        tags={CHIP_TAGS}
        showMax={4}
        undoWindowMs={0}
        composePrompt={({ text, tags }) => weave(text, tags)}
        placeholder="Describe a task, flip some tags…"
        onSubmit={(p) => setPrompt(p.prompt)}
      />
    </Section>
  );
}

/* 06 — master switch + scrollable tag list */
function TagListDemo() {
  const [prompt, setPrompt] = useState<string | null>(null);
  const [glOn, setGlOn] = useState(true);
  return (
    <Section
      n={6}
      title="Master switch & tag list"
      code={`const tags = [
  // chips (default group)…
  { id: 'worktree', label: 'Worktree' },
  // location chips → scrollable list
  { id: 'svc-traefik', slug: 'traefik',
    group: 'list', label: 'traefik' },
  // …
]

<RichInput
  tags={tags}
  masterSwitch={{ label: 'Guidelines' }}
  defaultMasterOn
  onMasterSwitchChange={setGlOn}
  tagListRows={3}           // scroll after 3 rows
  collapseWhenIdle          // rows hide while empty & unfocused
/>`}
      aside={
        <>
          <Readout label="master switch">
            <p className="text-xs text-foreground">
              currently <span className="mono text-[color:var(--cyan-deep)]">{glOn ? 'on' : 'off'}</span>
              {glOn ? ' — chip tags count' : ' — chip tags are muted'}
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
        Two clusters. The chip row sits under a{' '}
        <span className="mono text-foreground">masterSwitch</span> — flip it off and those chips
        hide <em>and</em> stop counting as selected, so they never reach{' '}
        <span className="mono text-foreground">composePrompt</span> or the send payload (their
        selection is remembered, not lost). Pass an object to word it (“Guidelines on/off”).
        Meanwhile <span className="mono text-foreground">group: 'list'</span> chips (project/service
        locations) stay put in their own scrollable list, capped at{' '}
        <span className="mono text-foreground">tagListRows</span> rows before it scrolls. Selected
        chips sort to the front of that list, and the leading <em>search</em> chip opens an inline
        filter over the tags (disable with{' '}
        <span className="mono text-foreground">tagSearch={'{false}'}</span>). With{' '}
        <span className="mono text-foreground">collapseWhenIdle</span> both rows stay hidden while
        the composer is empty and unfocused — click in (or start a draft) and they appear.
      </Lede>
      <RichInput
        tags={[...CHIP_TAGS, ...LOCATION_TAGS]}
        masterSwitch={{ label: 'Guidelines' }}
        onMasterSwitchChange={setGlOn}
        tagListRows={3}
        collapseWhenIdle
        showMax={4}
        undoWindowMs={0}
        composePrompt={({ text, tags }) => weave(text, tags)}
        placeholder="Toggle guidelines, pick a location…"
        onSubmit={(p) => setPrompt(p.prompt)}
      />
    </Section>
  );
}

/* 06b — a caller-owned tag hierarchy */
const NESTED_ROOTS: RichTag[] = [
  { id: 'worktree', label: 'Worktree', labelOff: 'On main', icon: <GitBranch className="size-3" />, defaultOn: true },
  { id: 'deploy', label: 'Deploy', icon: <Rocket className="size-3" /> },
];
const NESTED_CHILDREN: Record<string, RichTag[]> = {
  deploy: [
    { id: 'deploy-smoke', label: 'Smoke-test', depth: 1 },
    { id: 'deploy-rollback', label: 'Note rollback', depth: 1 },
  ],
};

function NestedTagsDemo() {
  const [active, setActive] = useState<string[]>([]);
  const [prompt, setPrompt] = useState<string | null>(null);
  // Derive the visible tags from the graph + what is currently on: a child only
  // exists while its parent is selected, so it can neither be shown nor sent.
  const tags = NESTED_ROOTS.flatMap((t) =>
    active.includes(t.id) ? [t, ...(NESTED_CHILDREN[t.id] ?? [])] : [t],
  );
  return (
    <Section
      n={7}
      title="Nested tags"
      code={`// the graph is yours; the composer only renders what you pass
const tags = ROOTS.flatMap(t =>
  active.includes(t.id)
    ? [t, ...CHILDREN[t.id] ?? []]   // reveal children
    : [t])

<RichInput
  tags={tags}                        // children carry depth: 1
  onTagsChange={t => setActive(t.map(x => x.id))}
/>`}
      aside={
        <Readout label="composed prompt">
          {prompt ? (
            <pre className="whitespace-pre-wrap text-[11px] leading-relaxed text-foreground">{prompt}</pre>
          ) : (
            <p className="text-xs text-muted-foreground">turn on Deploy to reveal its children</p>
          )}
        </Readout>
      }
    >
      <Lede>
        The composer has no idea your tags form a graph — and doesn't need one. Feed it a different{' '}
        <span className="mono text-foreground">tags</span> array as the selection changes and it
        keeps up: ids that disappear leave the selection with them, so a child turned on under{' '}
        <em>Deploy</em> stops counting the moment <em>Deploy</em> goes off. The only thing the chip
        row knows about hierarchy is <span className="mono text-foreground">depth</span>, which
        indents it behind a <span className="mono text-foreground">↳</span>.
      </Lede>
      <RichInput
        tags={tags}
        undoWindowMs={0}
        onTagsChange={(t) => setActive(t.map((x) => x.id))}
        composePrompt={({ text, tags }) => weave(text, tags)}
        placeholder="Turn on Deploy…"
        onSubmit={(p) => setPrompt(p.prompt)}
      />
    </Section>
  );
}

/* 07 — mention */
function MentionDemo() {
  const [prompt, setPrompt] = useState<string | null>(null);
  return (
    <Section
      n={8}
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
        tag on. This is the "show more" path when there are more tags than fit as chips.
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

/* 07b — auto-tag */
function AutoTagDemo() {
  const [picked, setPicked] = useState<RichTag[]>([]);
  return (
    <Section
      n={9}
      title="Auto-tag"
      code={`const tags = [{
  id: 'skill:screenshot',
  label: 'screenshot',
  color: 'var(--color-sky-500)',
  triggers: ['screenshot', 'take a screenshot'],
}, …]

<RichInput
  tags={tags}
  autoTag                 // or { debounceMs, max, minChars }
  onTagsChange={setPicked}
/>`}
      aside={
        <Readout label="selected tags">
          {picked.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              try <span className="mono text-foreground">take a screenshot of the deploy</span> or{' '}
              <span className="mono text-foreground">generate an image of a cat</span>
            </p>
          ) : (
            <ul className="space-y-1 text-xs text-foreground">
              {picked.map((t) => (
                <li key={t.id} className="mono truncate">
                  {t.id}
                </li>
              ))}
            </ul>
          )}
        </Readout>
      }
    >
      <Lede>
        The other half of <span className="mono text-foreground">#mention</span>: instead of you
        remembering a tag exists, the composer notices you already named it. A second after the
        typing stops, the text is scanned for the words each tag declares in{' '}
        <span className="mono text-foreground">triggers</span>, and every hit is asked about{' '}
        <strong className="text-foreground">where it sits in the sentence</strong> — circled by a
        travelling dashed ring in the tag's colour, with a ✓/✕ beside it. ✓ turns the tag on and the
        word keeps a coloured mark for as long as it stays on; ✕ dismisses it, and that word won't
        ask for that tag again until you send. Multi-word triggers outrank single words, so{' '}
        <span className="mono text-foreground">take a screenshot</span> beats{' '}
        <span className="mono text-foreground">screenshot</span> for the same span. A tag with no{' '}
        <span className="mono text-foreground">triggers</span> is never suggested — nothing is
        inferred from labels.
      </Lede>
      <RichInput
        tags={AUTO_TAGS}
        autoTag={{ debounceMs: 700 }}
        undoWindowMs={0}
        tagListRows={2}
        placeholder="Ask for a screenshot, a 3D model, an image…"
        onTagsChange={setPicked}
      />
    </Section>
  );
}

/* 08 — history */
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
      n={10}
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

/* 09 — imperative handle */
function ImperativeDemo() {
  const ref = useRef<RichInputHandle>(null);
  const [log, setLog] = useState<string[]>([]);
  const note = (s: string) => setLog((p) => [s, ...p].slice(0, 5));
  const onSubmit = (p: RichSendPayload) => note(`onSubmit → "${p.text}"`);
  return (
    <Section
      n={11}
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

/* 10 — reorderable toolbar */
function ToolbarReorderDemo() {
  return (
    <Section
      n={12}
      title="Reorderable toolbar"
      code={`<RichInput
  toolbarReorder="demo"    // persisted arrangement key
  toolbarExtraItems={[     // extras as movable items
    { id: 'model', label: 'Model', node: <ModelSelect /> },
  ]}
  accept="image/*"
/>`}
    >
      <Lede>
        With <span className="mono text-foreground">toolbarReorder</span> the bottom toolbar
        becomes a <span className="mono text-foreground">HoldEditable</span> group:{' '}
        <strong className="text-foreground">hold any control</strong> (~1.4s) to enter edit mode,
        then drag to rearrange — including the invisible <em>spacer</em> that splits the left and
        right clusters — or drag a control onto the stash popover to bench it (the send button
        can't be benched). Holding <strong className="text-foreground">send</strong> passes
        through a first stage (~0.5s) that opens its draft menu; keep holding to reach edit mode.
        The arrangement persists per storage key. Extras become individually movable via{' '}
        <span className="mono text-foreground">toolbarExtraItems</span>.
      </Lede>
      <RichInput
        cacheKey="ds-richinput-toolbar"
        toolbarReorder="ds-demo"
        accept="image/*"
        undoWindowMs={0}
        placeholder="Hold a toolbar button to rearrange the row…"
      />
    </Section>
  );
}
