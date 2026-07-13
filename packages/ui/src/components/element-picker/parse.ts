import type { ElementField, ElementInfo, ElementKind, ElementPathStep } from './types';

/**
 * The computed properties we read off a picked element, grouped the way the
 * inspector shows them. Anything the browser reports as its initial value is
 * dropped later, so a plain `<div>` doesn't come back with forty entries.
 */
export const STYLE_GROUPS: Record<string, string[]> = {
  Layout: [
    'display',
    'position',
    'top',
    'right',
    'bottom',
    'left',
    'zIndex',
    'flexDirection',
    'flexWrap',
    'alignItems',
    'justifyContent',
    'gap',
    'gridTemplateColumns',
    'gridTemplateRows',
    'overflow',
  ],
  Box: [
    'width',
    'height',
    'boxSizing',
    'padding',
    'margin',
    'border',
    'borderRadius',
  ],
  Typography: [
    'fontFamily',
    'fontSize',
    'fontWeight',
    'fontStyle',
    'lineHeight',
    'letterSpacing',
    'textAlign',
    'textTransform',
    'textDecorationLine',
    'whiteSpace',
  ],
  Visual: [
    'color',
    'backgroundColor',
    'backgroundImage',
    'opacity',
    'boxShadow',
    'transform',
    'transition',
    'cursor',
  ],
};

export const STYLE_PROPS: string[] = Object.values(STYLE_GROUPS).flat();

/** Values the browser reports when nothing was actually set. */
const BORING = new Set([
  '',
  'none',
  'auto',
  'normal',
  'static',
  '0px',
  'visible',
  'rgba(0, 0, 0, 0)',
  'start',
  'nowrap',
  'row',
  'stretch',
  'flex-start',
  'content-box',
  'transparent',
]);

const collapse = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Class names that are safe (and useful) to put in a selector. */
const usableClasses = (el: Element) =>
  Array.from(el.classList).filter((c) => /^[a-zA-Z_][\w-]*$/.test(c));

function nthOfType(el: Element): number {
  let n = 1;
  for (let sib = el.previousElementSibling; sib; sib = sib.previousElementSibling) {
    if (sib.tagName === el.tagName) n++;
  }
  return n;
}

/**
 * The shortest selector that still lands on exactly this element. Tries an
 * `#id` first, then a class-qualified path, and falls back to `:nth-of-type`
 * when a step is still ambiguous — the same ladder devtools climbs.
 */
export function uniqueSelector(el: HTMLElement, root: HTMLElement = document.body): string {
  const doc = el.ownerDocument;
  const hits = (sel: string) => {
    try {
      return doc.querySelectorAll(sel).length;
    } catch {
      return 0;
    }
  };

  if (el.id && /^[a-zA-Z_][\w-]*$/.test(el.id) && hits(`#${el.id}`) === 1) return `#${el.id}`;

  const steps: string[] = [];
  for (let node: HTMLElement | null = el; node && node !== root.parentElement; node = node.parentElement) {
    const tag = node.tagName.toLowerCase();
    if (node.id && /^[a-zA-Z_][\w-]*$/.test(node.id) && hits(`#${node.id}`) === 1) {
      steps.unshift(`#${node.id}`);
      break;
    }

    // Take the shortest step that still singles the node out among its
    // siblings: the bare tag, then a class or two, then the positional index.
    // Without that ladder a utility-class page yields selectors that are all
    // noise — `div.flex.min-w-0 > p.mt-0.5.truncate.text-xs` and so on.
    const parent: HTMLElement | null = node.parentElement;
    const ambiguous = (sel: string) =>
      !!parent && Array.from(parent.children).filter((c) => c.matches(sel)).length > 1;

    let step = tag;
    if (ambiguous(step)) {
      const classes = usableClasses(node).slice(0, 2);
      const qualified = classes.length ? `${tag}.${classes.join('.')}` : tag;
      step = ambiguous(qualified) ? `${qualified}:nth-of-type(${nthOfType(node)})` : qualified;
    }
    steps.unshift(step);

    const candidate = steps.join(' > ');
    if (hits(candidate) === 1) return candidate;
  }

  return steps.join(' > ');
}

/** The ancestor chain from the picker root down to the element itself. */
export function hierarchy(el: HTMLElement, root: HTMLElement): ElementPathStep[] {
  const chain: ElementPathStep[] = [];
  for (let node: HTMLElement | null = el; node && node !== root.parentElement; node = node.parentElement) {
    chain.unshift({
      tag: node.tagName.toLowerCase(),
      id: node.id || undefined,
      classes: Array.from(node.classList),
      nth: nthOfType(node),
    });
    if (node === root) break;
  }
  return chain;
}

const pathString = (chain: ElementPathStep[]) =>
  chain
    .map((s) => {
      let step = s.tag;
      if (s.id) step += `#${s.id}`;
      else if (s.classes.length) step += `.${s.classes[0]}`;
      if (s.nth > 1) step += `:nth-of-type(${s.nth})`;
      return step;
    })
    .join(' > ');

const LANDMARKS = new Set(['nav', 'header', 'footer', 'main', 'aside', 'section', 'article', 'dialog']);
const TEXTUAL = new Set(['p', 'span', 'strong', 'em', 'b', 'i', 'small', 'label', 'li', 'dt', 'dd', 'blockquote', 'code', 'pre', 'time', 'figcaption']);
const MEDIA = new Set(['img', 'svg', 'video', 'audio', 'canvas', 'picture', 'iframe']);

/** What the element *is*, as a human would name it. */
export function classify(el: HTMLElement): ElementKind {
  const tag = el.tagName.toLowerCase();
  const role = el.getAttribute('role');

  // A submit/reset/button input is a button first and a field second.
  if (tag === 'input' && /^(button|submit|reset|image)$/.test((el as HTMLInputElement).type)) return 'button';
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return 'input';
  if (tag === 'button' || role === 'button') return 'button';
  if (tag === 'a') return (el as HTMLAnchorElement).href ? 'link' : 'text';
  if (MEDIA.has(tag)) return 'media';
  if (/^h[1-6]$/.test(tag)) return 'heading';
  if (tag === 'form') return 'form';
  if (tag === 'table') return 'table';
  if (tag === 'ul' || tag === 'ol' || tag === 'dl' || role === 'list') return 'list';
  if (LANDMARKS.has(tag)) return 'landmark';
  if (TEXTUAL.has(tag)) return 'text';
  // A div holding nothing but words is text; a div holding boxes is a container.
  if (!el.children.length && collapse(el.textContent ?? '')) return 'text';
  return 'container';
}

function readField(el: HTMLElement): ElementField | undefined {
  const tag = el.tagName.toLowerCase();

  if (tag === 'input') {
    const input = el as HTMLInputElement;
    return {
      type: input.type,
      name: input.name || undefined,
      value: input.value,
      placeholder: input.placeholder || undefined,
      checked: input.type === 'checkbox' || input.type === 'radio' ? input.checked : undefined,
      required: input.required || undefined,
      disabled: input.disabled || undefined,
    };
  }
  if (tag === 'textarea') {
    const area = el as HTMLTextAreaElement;
    return {
      type: 'textarea',
      name: area.name || undefined,
      value: area.value,
      placeholder: area.placeholder || undefined,
      required: area.required || undefined,
      disabled: area.disabled || undefined,
    };
  }
  if (tag === 'select') {
    const select = el as HTMLSelectElement;
    return {
      type: select.multiple ? 'select-multiple' : 'select',
      name: select.name || undefined,
      value: select.value,
      required: select.required || undefined,
      disabled: select.disabled || undefined,
      options: Array.from(select.options).map((o) => [o.value, collapse(o.text)]),
    };
  }
  return undefined;
}

/** The element's accessible-ish name: aria-label, then its `<label>`, then alt/title. */
function labelOf(el: HTMLElement): string | undefined {
  const aria = el.getAttribute('aria-label');
  if (aria) return collapse(aria);

  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    const target = el.ownerDocument.getElementById(labelledBy);
    if (target) return collapse(target.textContent ?? '');
  }
  if (el.id) {
    const label = el.ownerDocument.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (label) return collapse(label.textContent ?? '');
  }
  const alt = el.getAttribute('alt') ?? el.getAttribute('title');
  return alt ? collapse(alt) : undefined;
}

function readStyles(el: HTMLElement, props: string[]): Record<string, string> {
  const computed = getComputedStyle(el);
  const out: Record<string, string> = {};
  for (const prop of props) {
    const value = computed.getPropertyValue(
      prop.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`),
    );
    if (!BORING.has(value.trim())) out[prop] = value.trim();
  }
  return out;
}

export interface ParseOptions {
  /** The subtree the selector and hierarchy are expressed relative to. */
  root?: HTMLElement;
  /** Override which computed properties are captured. */
  styleProps?: string[];
}

/** Read an element down to plain, serializable data. */
export function parseElement(el: HTMLElement, options: ParseOptions = {}): ElementInfo {
  const root = options.root ?? el.ownerDocument.body;
  const chain = hierarchy(el, root);
  const rect = el.getBoundingClientRect();
  const parent = el.parentElement;

  const attributes: Record<string, string> = {};
  for (const attr of Array.from(el.attributes)) attributes[attr.name] = attr.value;

  return {
    selector: uniqueSelector(el, root),
    path: pathString(chain),
    tag: el.tagName.toLowerCase(),
    kind: classify(el),
    id: el.id || undefined,
    classes: Array.from(el.classList),
    role: el.getAttribute('role') ?? undefined,
    label: labelOf(el),
    text: collapse(el.textContent ?? ''),
    outerHTML: el.outerHTML,
    innerHTML: el.innerHTML,
    attributes,
    dataset: { ...el.dataset } as Record<string, string>,
    hierarchy: chain,
    depth: Math.max(chain.length - 1, 0),
    index: parent ? Array.from(parent.children).indexOf(el) + 1 : 1,
    siblings: parent ? parent.children.length : 1,
    children: el.children.length,
    rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    styles: readStyles(el, options.styleProps ?? STYLE_PROPS),
    field: readField(el),
  };
}

const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

/**
 * Re-indent a serialized HTML string. `outerHTML` comes back as one line for
 * anything the browser normalized, which is unreadable past a few nodes.
 */
export function formatHtml(html: string, indent = '  '): string {
  const tokens = html
    .replace(/>\s+</g, '><')
    .split(/(<[^>]+>)/)
    .map((t) => t.trim())
    .filter(Boolean);

  const lines: string[] = [];
  let depth = 0;

  for (const token of tokens) {
    const isTag = token.startsWith('<');
    const isClose = token.startsWith('</');
    const tag = isTag ? /^<\/?([a-zA-Z0-9-]+)/.exec(token)?.[1]?.toLowerCase() : undefined;
    const selfClosing = isTag && (token.endsWith('/>') || (tag ? VOID_TAGS.has(tag) : false));

    if (isClose) depth = Math.max(depth - 1, 0);
    lines.push(indent.repeat(depth) + token);
    if (isTag && !isClose && !selfClosing && !token.startsWith('<!')) depth++;
  }

  return lines.join('\n');
}
