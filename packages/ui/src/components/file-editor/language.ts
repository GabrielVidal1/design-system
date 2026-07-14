/**
 * Map a file path/name to the Prism language id used for highlighting.
 * Only languages bundled with prism-react-renderer are returned; anything
 * else falls back to `'plain'` (rendered untokenized).
 */

/** Languages we resolve to — all part of prism-react-renderer's vendored set. */
const EXT_TO_LANGUAGE: Record<string, string> = {
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  ts: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'jsx',
  md: 'markdown',
  markdown: 'markdown',
  mdx: 'markdown',
  json: 'json',
  yml: 'yaml',
  yaml: 'yaml',
  css: 'css',
  // not vendored by prism-react-renderer — css is the closest grammar
  scss: 'css',
  sass: 'css',
  less: 'css',
  html: 'markup',
  htm: 'markup',
  xml: 'markup',
  svg: 'markup',
  py: 'python',
  go: 'go',
  rs: 'rust',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  hpp: 'cpp',
  sql: 'sql',
  graphql: 'graphql',
  diff: 'diff',
  patch: 'diff',
  makefile: 'makefile',
  toml: 'plain',
};

/** Extension-less well-known filenames. */
const NAME_TO_LANGUAGE: Record<string, string> = {
  makefile: 'makefile',
  dockerfile: 'bash',
  '.bashrc': 'bash',
  '.zshrc': 'bash',
  '.profile': 'bash',
  '.env': 'bash',
};

export function detectLanguage(path: string | undefined | null): string {
  if (!path) return 'plain';
  const name = path.split('/').pop()!.toLowerCase();
  if (NAME_TO_LANGUAGE[name]) return NAME_TO_LANGUAGE[name];
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return 'plain';
  return EXT_TO_LANGUAGE[name.slice(dot + 1)] ?? 'plain';
}

export const isMarkdownLanguage = (lang: string) => lang === 'markdown';
export const isHtmlLanguage = (lang: string) => lang === 'markup';
