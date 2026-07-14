import type { PrismTheme } from 'prism-react-renderer';

/**
 * Token-driven Prism theme. Every colour reads a `--code-*` custom property
 * (declared in theme.css for light and `.dark`), with the light value inlined
 * as fallback so highlighting still works for consumers on an older
 * theme.css. Retheme by overriding the variables — no component code.
 */
const v = (name: string, fallback: string) => `var(--code-${name}, ${fallback})`;

export const codeTheme: PrismTheme = {
  plain: {
    color: v('foreground', '#1c1917'),
    backgroundColor: 'transparent',
  },
  styles: [
    {
      types: ['comment', 'prolog', 'doctype', 'cdata'],
      style: { color: v('comment', '#78716c'), fontStyle: 'italic' },
    },
    {
      types: ['keyword', 'atrule', 'important', 'rule'],
      style: { color: v('keyword', '#7c3aed') },
    },
    {
      types: ['string', 'char', 'attr-value', 'inserted', 'url'],
      style: { color: v('string', '#15803d') },
    },
    {
      types: ['number', 'boolean', 'constant', 'symbol', 'deleted'],
      style: { color: v('number', '#b45309') },
    },
    {
      types: ['function', 'method'],
      style: { color: v('function', '#1d4ed8') },
    },
    {
      types: ['class-name', 'maybe-class-name', 'builtin', 'tag', 'selector'],
      style: { color: v('tag', '#be185d') },
    },
    {
      types: ['attr-name', 'property', 'variable', 'parameter'],
      style: { color: v('variable', '#0e7490') },
    },
    {
      types: ['operator', 'punctuation', 'combinator'],
      style: { color: v('punctuation', '#78716c') },
    },
    {
      types: ['regex', 'interpolation-punctuation', 'template-punctuation'],
      style: { color: v('regex', '#b45309') },
    },
    // markdown-specific niceties
    { types: ['title', 'bold'], style: { color: v('keyword', '#7c3aed'), fontWeight: 'bold' } },
    { types: ['italic'], style: { fontStyle: 'italic' } },
    { types: ['list'], style: { color: v('number', '#b45309') } },
  ],
};
