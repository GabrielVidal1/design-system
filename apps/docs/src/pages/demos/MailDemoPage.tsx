import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Archive, CornerUpLeft, Inbox, PanelRight } from 'lucide-react';
import {
  Badge,
  EmptyState,
  FuzzyList,
  RelativeTime,
  ResizableLayout,
  TagFilter,
  cn,
  useIsMobile,
} from '@gabvdl/ui';

import { DemoShell } from './DemoShell';

/*
 * Mailbox — the mail.lab screen rebuilt from the library alone. A catch-all
 * store foldered by address, a lazily paged inbox (the "server" hands out 40
 * rows at a time), quote-aware fuzzy search over everything loaded so far, and
 * folder chips that filter and carry live unread counts. Reading pane on the
 * right, a drawer on phones.
 */

interface Mail {
  id: string;
  folder: string;
  from: string;
  fromAddr: string;
  subject: string;
  snippet: string;
  body: string;
  at: number;
  outgoing?: boolean;
}

/* ------------------------------------------------------------------ */
/* The "server": a deterministic catch-all store, newest first.        */
/* ------------------------------------------------------------------ */

// Seeded PRNG so the mailbox is the same on every visit — the demo should
// read identically in a bug report and in the docs.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FOLDERS = [
  { id: 'gabvdl.xyz/contact', share: 0.3 },
  { id: 'gabvdl.xyz/gabriel', share: 0.25 },
  { id: 'lab.gabvdl.xyz/alerts', share: 0.2 },
  { id: 'gabvdl.xyz/shop-amazon', share: 0.15 },
  { id: 'ui.gabvdl.xyz/contact', share: 0.1 },
] as const;

const SENDERS: Record<string, [name: string, addr: string][]> = {
  'gabvdl.xyz/contact': [
    ['Marion Lefevre', 'marion@atelier-lefevre.fr'],
    ['Theo Brandt', 'theo.brandt@posteo.de'],
    ['Camille Roux', 'camille.roux@fastmail.com'],
    ['Jules Marchand', 'jules@marchand.studio'],
  ],
  'gabvdl.xyz/gabriel': [
    ['Anna Kovacs', 'anna.kovacs@proton.me'],
    ['Louis Perrin', 'louis.perrin@gmail.com'],
    ['Nadia El-Amrani', 'nadia@elamrani.net'],
  ],
  'lab.gabvdl.xyz/alerts': [
    ['Alertmanager', 'alertmanager@lab.gabvdl.xyz'],
    ['Grafana', 'grafana@lab.gabvdl.xyz'],
  ],
  'gabvdl.xyz/shop-amazon': [
    ['Amazon.fr', 'ship-confirm@amazon.fr'],
    ['Amazon.fr', 'order-update@amazon.fr'],
  ],
  'ui.gabvdl.xyz/contact': [
    ['Rasmus Dahl', 'rasmus@dahl.design'],
    ['Ines Ferreira', 'ines.ferreira@hey.com'],
  ],
};

const SUBJECTS: Record<string, string[]> = {
  'gabvdl.xyz/contact': [
    'Loved the browser games portfolio',
    'Question about the zine maker',
    'Freelance enquiry — small data-viz site',
    'Broken link on the dev portfolio?',
    'Talk proposal: self-hosting a design system',
    'Your spider rig editor is delightful',
  ],
  'gabvdl.xyz/gabriel': [
    'Weekend plans — climbing?',
    'That book I mentioned',
    'Re: flat dinner on Friday',
    'Photos from the hike',
    'Re: train tickets for August',
  ],
  'lab.gabvdl.xyz/alerts': [
    '[FIRING:1] DiskSpaceLow raspy2 /mnt/nvme',
    '[RESOLVED] DiskSpaceLow raspy2 /mnt/nvme',
    '[FIRING:1] TargetDown evox2 exporter',
    '[FIRING:2] CertExpirySoon traefik',
    '[RESOLVED] TargetDown evox2 exporter',
  ],
  'gabvdl.xyz/shop-amazon': [
    'Your order has shipped',
    'Delivered: your package',
    'Your invoice for order #403-551',
    'A product in your order was delayed',
  ],
  'ui.gabvdl.xyz/contact': [
    'TagFilter API question',
    'Using @gabvdl/ui outside the lab',
    'Dark theme token override',
    'VirtualList with 100k rows — works!',
  ],
};

const BODY_LINES = [
  'Hope this finds you well — I stumbled on your site last week and have been poking around since.',
  'The details are below; no rush on a reply, whenever you get a moment is fine.',
  'I tried it on my phone first and the whole thing just worked, which honestly surprised me.',
  'Let me know if a short call is easier, otherwise mail works great.',
  'One small thing: the footer link 404s on mobile Safari, might be worth a look.',
  'Attached the notes we talked about. The second section is the one that matters.',
  'If you ever write up how the pipeline works end to end, I would read every word.',
  'Thanks again for the quick answer last time — it unblocked the whole week.',
];

const MAILBOX: Mail[] = (() => {
  const rand = mulberry32(20260714);
  const out: Mail[] = [];
  const total = 1200;
  // Demo epoch — "now" at module load; fine for fake data.
  let at = Date.now() - 4 * 60_000;
  for (let i = 0; i < total; i++) {
    // Walk time backwards 5 min – 6 h per message ≈ two years of mailbox.
    at -= (5 + rand() * 355) * 60_000;
    const r = rand();
    let acc = 0;
    const folder = FOLDERS.find((f) => (acc += f.share) >= r)?.id ?? FOLDERS[0].id;
    const [from, fromAddr] = SENDERS[folder][Math.floor(rand() * SENDERS[folder].length)];
    const subject = SUBJECTS[folder][Math.floor(rand() * SUBJECTS[folder].length)];
    const lines = Array.from(
      { length: 2 + Math.floor(rand() * 3) },
      () => BODY_LINES[Math.floor(rand() * BODY_LINES.length)],
    );
    out.push({
      id: `m${i.toString(36)}`,
      folder,
      from,
      fromAddr,
      subject,
      snippet: lines[0],
      body: lines.join('\n\n'),
      at,
    });
  }
  return out;
})();

const PAGE = 40;
const LATENCY = 450;

/** The fake list endpoint: `GET /api/messages?folder=&offset=&limit=`. */
function fetchPage(folder: string | null, offset: number): Promise<{ rows: Mail[]; hasMore: boolean }> {
  const all = folder ? MAILBOX.filter((m) => m.folder === folder) : MAILBOX;
  return new Promise((resolve) =>
    setTimeout(
      () => resolve({ rows: all.slice(offset, offset + PAGE), hasMore: offset + PAGE < all.length }),
      LATENCY,
    ),
  );
}

/* ------------------------------------------------------------------ */
/* The client.                                                          */
/* ------------------------------------------------------------------ */

/** `gabvdl.xyz/contact` → `contact`, `ui.gabvdl.xyz/contact` → `ui/contact` —
 * the subdomain stays only where it disambiguates. */
const FOLDER_LABEL = (id: string) => {
  const [domain, local] = id.split('/');
  const sub = domain.replace(/\.?gabvdl\.xyz$/, '');
  return sub ? `${sub}/${local}` : local;
};

export function MailDemoPage() {
  const isMobile = useIsMobile();
  const [folder, setFolder] = useState<string[]>([]);
  const [loaded, setLoaded] = useState<Mail[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [readIds, setReadIds] = useState<ReadonlySet<string>>(() => new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [paneOpen, setPaneOpen] = useState(false);
  // A folder switch mid-flight must drop the stale page when it lands.
  const epoch = useRef(0);

  const selected = folder[0] ?? null;

  const load = useCallback(
    (offset: number) => {
      const mine = ++epoch.current;
      setLoading(true);
      void fetchPage(selected, offset).then(({ rows, hasMore: more }) => {
        if (epoch.current !== mine) return;
        setLoaded((prev) => (offset === 0 ? rows : [...prev, ...rows]));
        setHasMore(more);
        setLoading(false);
      });
    },
    [selected],
  );

  // First page — and again from the top whenever the folder filter changes.
  useEffect(() => {
    setLoaded([]);
    setHasMore(true);
    load(0);
  }, [load]);

  const open = (m: Mail) => {
    setOpenId(m.id);
    setReadIds((prev) => (prev.has(m.id) ? prev : new Set(prev).add(m.id)));
    if (isMobile) setPaneOpen(true);
  };

  // Unread counts come from the whole store (the server knows), minus what
  // this session has read — so the chips tick down live as you read.
  const chips = useMemo(
    () =>
      FOLDERS.map((f) => ({
        id: f.id,
        label: FOLDER_LABEL(f.id),
        count: MAILBOX.filter((m) => m.folder === f.id && !readIds.has(m.id)).length,
      })),
    [readIds],
  );

  const openMail = openId ? MAILBOX.find((m) => m.id === openId) ?? null : null;

  const reader = openMail ? (
    <article className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold leading-snug text-foreground">{openMail.subject}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="font-medium text-foreground">{openMail.from}</span>
          <span className="mono text-xs text-muted-foreground">{openMail.fromAddr}</span>
          <RelativeTime date={openMail.at} className="text-xs text-muted-foreground" />
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <Badge dot>{openMail.folder}</Badge>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <p className="max-w-[60ch] whitespace-pre-wrap text-sm leading-relaxed text-foreground">{openMail.body}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2 border-t border-border px-4 py-2.5">
        <span className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground">
          <CornerUpLeft className="size-3.5" /> Reply
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground">
          <Archive className="size-3.5" /> Archive
        </span>
        <span className="ml-auto mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
          demo — send is wired to nothing
        </span>
      </div>
    </article>
  ) : (
    <EmptyState icon={<Inbox />} title="Nothing open" description="Pick a message from the list." />
  );

  return (
    <DemoShell name="Mailbox" proves="FuzzyList · VirtualList · TagFilter · Badge · RelativeTime · ResizableLayout">
      <ResizableLayout
        autoSaveId="demo-mail"
        right={{ content: reader, defaultSize: 44, mobileMode: 'drawer' }}
        rightOpen={isMobile ? paneOpen : true}
        onRightOpenChange={setPaneOpen}
      >
        <div className="flex h-full min-h-0 flex-col gap-2.5 p-2.5 sm:p-3">
          <div className="flex items-center gap-2">
            <TagFilter allLabel="All mail" items={chips} value={folder} onChange={setFolder} className="min-w-0 flex-1" />
            {isMobile && openMail && (
              <button
                type="button"
                aria-label="Open reading pane"
                onClick={() => setPaneOpen(true)}
                className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <PanelRight className="size-4" />
              </button>
            )}
          </div>

          <FuzzyList<Mail>
            items={loaded}
            keys={[
              { name: 'subject', weight: 2 },
              { name: 'from', weight: 1.5 },
              'fromAddr',
              'snippet',
            ]}
            getItemKey={(m) => m.id}
            onSelect={open}
            placeholder='Search mail — try alerts, amazon, or "TagFilter"…'
            emptyState="No mail matches — scroll loads more to search."
            debounce={150}
            estimateSize={74}
            onEndReached={() => load(loaded.length)}
            hasMore={hasMore}
            loadingMore={loading}
            loadMoreWhileSearching
            className="min-h-0 flex-1"
            renderItem={({ item: m, active, highlight }) => {
              const unread = !readIds.has(m.id);
              return (
                <div
                  className={cn(
                    'flex gap-2.5 rounded-lg border border-transparent px-3 py-2 transition-colors',
                    active ? 'border-border bg-muted/60' : 'hover:bg-muted/40',
                    openId === m.id && 'border-border bg-muted/60',
                  )}
                >
                  <span
                    className={cn('mt-2 size-1.5 shrink-0 rounded-full', unread ? 'bg-primary' : 'bg-transparent')}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={cn('truncate text-sm', unread ? 'font-semibold text-foreground' : 'text-foreground/80')}>
                        {highlight('from')}
                      </span>
                      <RelativeTime date={m.at} className="shrink-0 text-[11px] text-muted-foreground" />
                    </div>
                    <p className={cn('truncate text-[13px]', unread ? 'text-foreground' : 'text-muted-foreground')}>
                      {highlight('subject')}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {highlight('snippet', { snippet: true })}
                      {!selected && (
                        <span className="mono ml-1.5 text-[10px] text-muted-foreground/70">{FOLDER_LABEL(m.folder)}</span>
                      )}
                    </p>
                  </div>
                </div>
              );
            }}
          />
        </div>
      </ResizableLayout>
    </DemoShell>
  );
}
