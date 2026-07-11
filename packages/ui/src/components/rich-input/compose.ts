import type { ComposeInput } from './types';

/**
 * Default prompt composer: appends an attachments block, the injected guideline
 * lines and any tag descriptions under the raw text. Callers that want a
 * different shape (or none) pass their own `composePrompt`.
 */
export function defaultComposePrompt({ text, guidelines, tags, files }: ComposeInput): string {
  const lines: string[] = [text.trim()];

  if (files.length > 0) {
    lines.push('', 'Attachments:');
    for (const f of files) lines.push(`- ${f.name}`);
  }

  const described = tags.filter((t) => t.description);
  if (described.length > 0) {
    lines.push('', 'Context:');
    for (const t of described) lines.push(`- ${t.label} — ${t.description}`);
  }

  const clean = guidelines.map((g) => g.trim()).filter(Boolean);
  if (clean.length > 0) {
    lines.push('', 'Guidelines:');
    for (const g of clean) lines.push(`- ${g}`);
  }

  return lines.join('\n');
}

/** The guideline line a tag contributes for its current on/off state. */
export function tagGuideline(tag: { prompt?: string; promptOff?: string }, on: boolean): string | null {
  const line = on ? tag.prompt : tag.promptOff;
  return line?.trim() ? line : null;
}
