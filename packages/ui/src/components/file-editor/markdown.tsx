import * as React from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Highlight } from 'prism-react-renderer';

import { cn } from '../../lib/utils';
import { codeTheme } from './prism-theme';

export interface MarkdownProps {
  source: string;
  /**
   * Split a leading `--- … ---` YAML frontmatter block off the body and render
   * it as a key/value table. Parsing is deliberately naive (top-level
   * `key: value` scalars); anything richer stays on one line as written.
   * Default `false`.
   */
  frontmatter?: boolean;
  /** Merged over the built-in element renderers. */
  components?: Components;
  className?: string;
}

function splitFrontmatter(src: string): { fm: [string, string][] | null; body: string } {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { fm: null, body: src };
  const entries: [string, string][] = [];
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (kv) entries.push([kv[1], kv[2]]);
    else if (entries.length && /^\s+\S/.test(line)) {
      // continuation (nested/indented yaml) — append verbatim
      entries[entries.length - 1][1] += ` ${line.trim()}`;
    }
  }
  if (entries.length === 0) return { fm: null, body: src };
  return { fm: entries, body: src.slice(m[0].length) };
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  return (
    <Highlight code={code.replace(/\n$/, '')} language={language} theme={codeTheme}>
      {({ tokens, getLineProps, getTokenProps }) => (
        <pre className="my-3 overflow-x-auto rounded-lg border border-border bg-muted/40 p-3 font-mono text-[12.5px] leading-[1.6]">
          {tokens.map((line, i) => (
            <div key={i} {...getLineProps({ line })}>
              {line.map((token, j) => (
                <span key={j} {...getTokenProps({ token })} />
              ))}
            </div>
          ))}
        </pre>
      )}
    </Highlight>
  );
}

/* Tailwind-styled element map — tokens only, no typography plugin. */
const baseComponents: Components = {
  h1: (p) => <h1 className="mb-3 mt-5 text-2xl font-bold tracking-tight first:mt-0" {...p} />,
  h2: (p) => <h2 className="mb-2 mt-5 border-b border-border pb-1 text-xl font-semibold first:mt-0" {...p} />,
  h3: (p) => <h3 className="mb-2 mt-4 text-lg font-semibold" {...p} />,
  h4: (p) => <h4 className="mb-1 mt-3 text-base font-semibold" {...p} />,
  p: (p) => <p className="my-2.5 leading-relaxed" {...p} />,
  a: (p) => (
    <a className="text-primary underline underline-offset-2 hover:opacity-80" target="_blank" rel="noreferrer" {...p} />
  ),
  ul: (p) => <ul className="my-2.5 ml-5 list-disc space-y-1" {...p} />,
  ol: (p) => <ol className="my-2.5 ml-5 list-decimal space-y-1" {...p} />,
  li: (p) => <li className="leading-relaxed" {...p} />,
  blockquote: (p) => (
    <blockquote className="my-3 border-l-2 border-primary/50 pl-3 italic text-muted-foreground" {...p} />
  ),
  hr: () => <hr className="my-5 border-border" />,
  table: (p) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-sm" {...p} />
    </div>
  ),
  th: (p) => <th className="border border-border bg-muted/50 px-2.5 py-1.5 text-left font-semibold" {...p} />,
  td: (p) => <td className="border border-border px-2.5 py-1.5 align-top" {...p} />,
  img: (p) => <img className="my-3 max-w-full rounded-lg border border-border" {...p} />,
  input: (p) => <input className="mr-1.5 accent-[var(--primary)]" {...p} />,
  pre: (p) => <>{p.children}</>,
  code: ({ className, children, ...rest }) => {
    const lang = /language-(\w+)/.exec(className ?? '');
    const text = String(children ?? '');
    // fenced block (has a language, or is multi-line) → highlighted block
    if (lang || text.includes('\n')) {
      return <CodeBlock language={lang?.[1] ?? 'plain'} code={text} />;
    }
    return (
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]" {...rest}>
        {children}
      </code>
    );
  },
};

/**
 * Markdown — GFM markdown rendered with the design tokens, fenced code blocks
 * syntax-highlighted with the same theme as `FileEditor`/`CodeArea`.
 */
export function Markdown({ source, frontmatter = false, components, className }: MarkdownProps) {
  const { fm, body } = React.useMemo(
    () => (frontmatter ? splitFrontmatter(source) : { fm: null, body: source }),
    [source, frontmatter],
  );
  return (
    <div className={cn('text-[14px] text-foreground', className)}>
      {fm && (
        <div className="mb-4 overflow-hidden rounded-lg border border-border bg-muted/40">
          <div className="border-b border-border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Frontmatter
          </div>
          <dl className="divide-y divide-border">
            {fm.map(([k, v]) => (
              <div key={k} className="flex gap-3 px-3 py-1.5 text-[13px]">
                <dt className="w-32 shrink-0 font-mono text-muted-foreground">{k}</dt>
                <dd className="min-w-0 break-words">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ ...baseComponents, ...components }}>
        {body}
      </ReactMarkdown>
    </div>
  );
}
