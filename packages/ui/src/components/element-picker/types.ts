/** What kind of thing the element is, judged from its tag, role and content. */
export type ElementKind =
  | 'input'
  | 'button'
  | 'link'
  | 'media'
  | 'heading'
  | 'text'
  | 'list'
  | 'table'
  | 'form'
  | 'landmark'
  | 'container';

/** One rung of the ancestor chain, root-first. */
export interface ElementPathStep {
  tag: string;
  id?: string;
  classes: string[];
  /** 1-based position among siblings of the same tag. */
  nth: number;
}

/** The form state of an `<input>`/`<textarea>`/`<select>`, when there is one. */
export interface ElementField {
  /** `type` for an input, otherwise the tag: `textarea`, `select`. */
  type: string;
  name?: string;
  value?: string;
  placeholder?: string;
  checked?: boolean;
  required?: boolean;
  disabled?: boolean;
  /** `<select>` options, as `[value, label]`. */
  options?: [string, string][];
}

/**
 * Everything we learn about a picked element — plain data, safe to
 * `JSON.stringify`, post to an API or diff. The live node is kept beside it on
 * {@link PickedElement}, never in here.
 */
export interface ElementInfo {
  /** A CSS selector that resolves to this element, and only this element. */
  selector: string;
  /** The same thing spelled out: `main > section.cards > div.card:nth-of-type(2)`. */
  path: string;
  tag: string;
  kind: ElementKind;
  id?: string;
  classes: string[];
  role?: string;
  label?: string;
  /** Visible text, whitespace-collapsed. */
  text: string;
  outerHTML: string;
  innerHTML: string;
  attributes: Record<string, string>;
  /** `data-*` attributes, camelCased, as the DOM exposes them. */
  dataset: Record<string, string>;
  /** Ancestors from the picker root down to (and including) the element. */
  hierarchy: ElementPathStep[];
  /** How deep below the picker root it sits — the root's children are 1. */
  depth: number;
  /** 1-based position among *all* siblings. */
  index: number;
  siblings: number;
  children: number;
  rect: { x: number; y: number; width: number; height: number };
  /** Computed styles worth reading — see `STYLE_PROPS`. */
  styles: Record<string, string>;
  field?: ElementField;
}

/** A selected element: the live node, plus what we parsed out of it. */
export interface PickedElement {
  /** Stable across re-picks of the same node. */
  id: string;
  element: HTMLElement;
  info: ElementInfo;
}
