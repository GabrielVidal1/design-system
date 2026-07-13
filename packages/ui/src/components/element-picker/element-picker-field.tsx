import * as React from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Crosshair, MousePointerClick, Trash2, X } from 'lucide-react';

import { cn } from '../../lib/utils';
import { Badge, type Tone } from '../status-badge';
import { Button } from '../button';
import { CopyButton } from '../copy-button';
import { ElementPickerOverlay } from './element-picker';
import { ElementPreview } from './element-preview';
import { formatHtml, STYLE_GROUPS } from './parse';
import { useElementPicker, type UseElementPickerOptions } from './use-element-picker';
import type { ElementInfo, ElementKind, PickedElement } from './types';

const KIND_TONE: Record<ElementKind, Tone> = {
  input: 'violet',
  button: 'sky',
  link: 'sky',
  media: 'amber',
  heading: 'emerald',
  text: 'emerald',
  list: 'neutral',
  table: 'neutral',
  form: 'violet',
  landmark: 'rose',
  container: 'neutral',
};

type View = 'preview' | 'html' | 'parsed';
const VIEWS: { id: View; label: string }[] = [
  { id: 'preview', label: 'Preview' },
  { id: 'html', label: 'HTML' },
  { id: 'parsed', label: 'Parsed' },
];

/** Ties a card in the list back to the element it came from, out in the page. */
function Spotlight({ element }: { element: HTMLElement }) {
  const [rect, setRect] = React.useState<DOMRect | null>(null);

  React.useEffect(() => {
    if (!element.isConnected) return;
    element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

    let frame = 0;
    const tick = () => {
      const next = element.getBoundingClientRect();
      setRect((prev) =>
        prev && prev.x === next.x && prev.y === next.y && prev.width === next.width && prev.height === next.height
          ? prev
          : next,
      );
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [element]);

  if (!rect) return null;

  return createPortal(
    <div
      aria-hidden
      style={{ position: 'fixed', left: rect.x - 2, top: rect.y - 2, width: rect.width + 4, height: rect.height + 4 }}
      className="pointer-events-none z-[9997] rounded-[3px] bg-sky-500/10 outline-2 outline-dashed outline-sky-500"
    />,
    document.body,
  );
}

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-[7rem_1fr] gap-2 py-1 text-xs">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="min-w-0 break-words font-mono text-foreground">{children}</dd>
  </div>
);

/** The parse, laid out for reading: what it is, where it sits, what it says. */
function ParsedView({ info }: { info: ElementInfo }) {
  const styleGroups = Object.entries(STYLE_GROUPS)
    .map(([group, props]) => [group, props.filter((p) => info.styles[p] !== undefined)] as const)
    .filter(([, props]) => props.length > 0);

  const attrs = Object.entries(info.attributes).filter(([k]) => k !== 'class' && k !== 'id' && !k.startsWith('data-'));

  return (
    <div className="space-y-4">
      <section>
        <h4 className="mb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Identity</h4>
        <dl>
          <Row label="type">
            <Badge tone={KIND_TONE[info.kind]}>{info.kind}</Badge>
          </Row>
          <Row label="tag">&lt;{info.tag}&gt;</Row>
          {info.id && <Row label="id">#{info.id}</Row>}
          {info.classes.length > 0 && <Row label="classes">{info.classes.map((c) => `.${c}`).join(' ')}</Row>}
          {info.role && <Row label="role">{info.role}</Row>}
          {info.label && <Row label="label">{info.label}</Row>}
          <Row label="selector">{info.selector}</Row>
        </dl>
      </section>

      <section>
        <h4 className="mb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Hierarchy</h4>
        <dl>
          <Row label="path">
            <span className="text-muted-foreground">{info.path}</span>
          </Row>
          <Row label="depth">{info.depth}</Row>
          <Row label="position">
            {info.index} of {info.siblings}
          </Row>
          <Row label="children">{info.children}</Row>
          <Row label="size">
            {Math.round(info.rect.width)} × {Math.round(info.rect.height)}
          </Row>
        </dl>
      </section>

      <section>
        <h4 className="mb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Content</h4>
        {info.text ? (
          <p className="rounded-md bg-muted/50 p-2 text-xs whitespace-pre-wrap text-foreground">{info.text}</p>
        ) : (
          <p className="text-xs text-muted-foreground italic">No text</p>
        )}
      </section>

      {info.field && (
        <section>
          <h4 className="mb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Field</h4>
          <dl>
            {Object.entries(info.field).map(([key, value]) =>
              value === undefined ? null : (
                <Row key={key} label={key}>
                  {key === 'options'
                    ? (value as [string, string][]).map(([v]) => v).join(', ')
                    : String(value) || <span className="text-muted-foreground">(empty)</span>}
                </Row>
              ),
            )}
          </dl>
        </section>
      )}

      {(attrs.length > 0 || Object.keys(info.dataset).length > 0) && (
        <section>
          <h4 className="mb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Attributes</h4>
          <dl>
            {attrs.map(([k, v]) => (
              <Row key={k} label={k}>
                {v || <span className="text-muted-foreground">(empty)</span>}
              </Row>
            ))}
            {Object.entries(info.dataset).map(([k, v]) => (
              <Row key={k} label={`data.${k}`}>
                {v}
              </Row>
            ))}
          </dl>
        </section>
      )}

      <section>
        <h4 className="mb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Styles</h4>
        {styleGroups.map(([group, props]) => (
          <div key={group} className="mb-2">
            <p className="mb-0.5 text-[11px] font-medium text-foreground/70">{group}</p>
            <dl>
              {props.map((p) => (
                <Row key={p} label={p}>
                  {info.styles[p]}
                </Row>
              ))}
            </dl>
          </div>
        ))}
      </section>
    </div>
  );
}

function PickedCard({
  entry,
  index,
  defaultView,
  onRemove,
}: {
  entry: PickedElement;
  index: number;
  defaultView: View;
  onRemove: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [view, setView] = React.useState<View>(defaultView);
  const [spotlit, setSpotlit] = React.useState(false);
  const { info, element } = entry;

  const html = React.useMemo(() => formatHtml(info.outerHTML), [info.outerHTML]);

  return (
    <li
      onMouseEnter={() => setSpotlit(true)}
      onMouseLeave={() => setSpotlit(false)}
      className="overflow-hidden rounded-xl border border-border bg-card"
    >
      {spotlit && element.isConnected && <Spotlight element={element} />}

      <div className="flex items-center gap-3 p-2">
        <div className="relative shrink-0">
          <ElementPreview element={element} height={56} minScale={0.34} className="w-24" />
          {/* Bottom corner: a cropped thumbnail reads from the top-left. */}
          <span className="absolute -bottom-1 -left-1 flex size-4 items-center justify-center rounded-full bg-sky-500 text-[9px] font-bold text-white">
            {index + 1}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={open}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <code className="truncate text-xs font-medium text-foreground">
                {info.tag}
                {info.id ? `#${info.id}` : info.classes[0] ? `.${info.classes[0]}` : ''}
              </code>
              <Badge tone={KIND_TONE[info.kind]}>{info.kind}</Badge>
            </div>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {info.text || info.label || info.path}
            </p>
          </div>
          <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </button>

        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${info.tag}`}
          className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <X className="size-4" />
        </button>
      </div>

      {open && (
        <div className="border-t border-border">
          <div className="flex items-center justify-between gap-2 px-2 py-1.5">
            <div className="flex gap-0.5 rounded-lg bg-muted p-0.5">
              {VIEWS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setView(v.id)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                    view === v.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <CopyButton
              value={() => (view === 'html' ? html : view === 'parsed' ? JSON.stringify(info, null, 2) : info.text)}
              label={view === 'html' ? 'Copy HTML' : view === 'parsed' ? 'Copy JSON' : 'Copy text'}
            />
          </div>

          <div className="max-h-80 overflow-auto px-3 pt-1 pb-3">
            {view === 'preview' && <ElementPreview element={element} height={200} />}
            {view === 'html' && (
              <pre className="overflow-x-auto rounded-lg bg-muted/50 p-3 font-mono text-[11px] leading-relaxed text-foreground">
                {html}
              </pre>
            )}
            {view === 'parsed' && <ParsedView info={info} />}
          </div>
        </div>
      )}
    </li>
  );
}

export interface ElementPickerFieldProps extends UseElementPickerOptions {
  /** Field label. */
  label?: React.ReactNode;
  /** Small print under the label. */
  hint?: React.ReactNode;
  /** Text on the trigger while idle. */
  pickLabel?: string;
  /** Shown when nothing is selected yet. */
  emptyLabel?: React.ReactNode;
  /** Which detail tab a card opens on. Default `parsed`. */
  defaultView?: View;
  className?: string;
}

/**
 * The element picker as a form input: a trigger that arms the page, and a list
 * of what you selected — each with a live thumbnail, its formatted HTML, and
 * the parse (text, kind, hierarchy, attributes, computed styles) laid out for
 * reading. Hovering a card spotlights the element back in the page.
 *
 * The value is `PickedElement[]`; `info` on each is plain data, so
 * `JSON.stringify(picked.map((p) => p.info))` is a ready-made payload — which
 * is the point: this is how you let someone hand an LLM, a scraper or a bug
 * report the exact bits of a page they mean.
 */
export function ElementPickerField({
  label = 'Page elements',
  hint,
  pickLabel = 'Pick elements',
  emptyLabel = 'Nothing selected yet',
  defaultView = 'parsed',
  className,
  ...options
}: ElementPickerFieldProps) {
  const picker = useElementPicker(options);
  const { active, start, stop, picked, remove, clear, ignoreProps } = picker;

  return (
    <div {...ignoreProps} className={cn('space-y-3', className)}>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <label className="text-sm font-medium text-foreground">{label}</label>
          {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {picked.length > 0 && (
            <Button variant="ghost" size="sm" icon={<Trash2 />} onClick={clear}>
              Clear
            </Button>
          )}
          <Button
            variant={active ? 'default' : 'outline'}
            size="sm"
            icon={active ? <MousePointerClick /> : <Crosshair />}
            onClick={active ? stop : start}
          >
            {active ? 'Picking…' : pickLabel}
          </Button>
        </div>
      </div>

      {picked.length === 0 ? (
        <button
          type="button"
          onClick={start}
          className={cn(
            'flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border px-6 py-8 text-center transition-colors',
            'hover:border-ring/60 hover:bg-muted/40',
            active && 'border-ring bg-muted/50',
          )}
        >
          <Crosshair className={cn('size-5 text-muted-foreground', active && 'animate-pulse text-foreground')} />
          <p className="text-sm font-medium text-foreground">{active ? 'Point at the page…' : emptyLabel}</p>
          <p className="text-xs text-muted-foreground">
            {active ? 'Hover to preview, click to select' : 'Click to start picking elements'}
          </p>
        </button>
      ) : (
        <ul className="space-y-2">
          {picked.map((entry, i) => (
            <PickedCard
              key={entry.id}
              entry={entry}
              index={i}
              defaultView={defaultView}
              onRemove={() => remove(entry.id)}
            />
          ))}
        </ul>
      )}

      {/* The same picker the field is driving — one hook, one set of listeners. */}
      <ElementPickerOverlay picker={picker} />
    </div>
  );
}
