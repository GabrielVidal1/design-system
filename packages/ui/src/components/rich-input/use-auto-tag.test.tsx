import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { RichInput } from './rich-input';
import { findAutoTagMatches } from './use-auto-tag';
import type { RichTag } from './types';

const TAGS: RichTag[] = [
  {
    id: 'skill:screenshot',
    label: 'screenshot',
    group: 'list',
    triggers: ['screenshot', 'take a screenshot'],
    color: '#0ea5e9',
  },
  {
    id: 'skill:nanobanana',
    label: 'nanobanana',
    slug: 'nanobanana',
    group: 'list',
    triggers: ['nanobanana', 'generate an image'],
  },
  { id: 'plain', label: 'no-triggers', group: 'list' },
];

const at = (text: string, tags = TAGS) => findAutoTagMatches(text, tags);

describe('findAutoTagMatches', () => {
  it('matches a trigger word, case-insensitively, on word boundaries', () => {
    const m = at('Please take a Screenshot of it');
    expect(m).toHaveLength(1);
    expect(m[0].tag.id).toBe('skill:screenshot');
    expect(m[0].text).toBe('take a Screenshot');
  });

  it('ignores a trigger embedded in a longer word', () => {
    expect(at('screenshotting is not screenshot-ish')).toHaveLength(0);
  });

  it('never suggests a tag that declares no triggers', () => {
    expect(at('no-triggers everywhere').some((m) => m.tag.id === 'plain')).toBe(false);
  });

  it('prefers the multi-word phrase over the single word it contains', () => {
    const m = at('can you take a screenshot');
    expect(m).toHaveLength(1);
    expect(m[0].text).toBe('take a screenshot');
  });

  it('tolerates any whitespace inside a phrase, including a line break', () => {
    const m = at('take a\n  screenshot');
    expect(m).toHaveLength(1);
    expect(m[0].text).toBe('take a\n  screenshot');
  });

  it('finds every occurrence, in reading order', () => {
    const m = at('screenshot then nanobanana then screenshot');
    expect(m.map((x) => x.tag.label)).toEqual(['screenshot', 'nanobanana', 'screenshot']);
    expect(m[0].start).toBeLessThan(m[1].start);
  });

  it('skips a hit that is already an explicit #mention', () => {
    expect(at('use #nanobanana here')).toHaveLength(0);
  });
});

describe('RichInput autoTag', () => {
  const type = async (text: string, tags = TAGS) => {
    const user = userEvent.setup();
    const { container } = render(<RichInput tags={tags} autoTag={{ debounceMs: 10 }} />);
    await user.click(screen.getByRole('textbox'));
    await user.paste(text);
    return { user, container };
  };
  const markOf = (container: HTMLElement, word: string) =>
    [...container.querySelectorAll<HTMLElement>('[data-at-key]')].find((el) => el.textContent === word);
  const chipOrder = () =>
    screen
      .getAllByRole('button')
      .map((b) => b.textContent ?? '')
      .filter((t) => ['screenshot', 'nanobanana', 'no-triggers'].includes(t));

  it('floats a matched tag to the front of the list once the typing settles', async () => {
    // Reversed so the matched tag starts last.
    await type('please screenshot the page', [...TAGS].reverse());
    await waitFor(() => expect(chipOrder()[0]).toBe('screenshot'));
  });

  it('draws nothing in the text while the tag is off: no mark, no ring, no buttons', async () => {
    const { container } = await type('please screenshot the page', [...TAGS].reverse());
    await waitFor(() => expect(chipOrder()[0]).toBe('screenshot'));
    expect(container.querySelector('[data-at-key]')).toBeNull();
    expect(container.querySelector('svg rect')).toBeNull();
    expect(screen.queryByLabelText(/Add tag|Dismiss suggested tag/)).toBeNull();
  });

  it('does not reorder until the debounce elapses', async () => {
    const user = userEvent.setup();
    render(<RichInput tags={[...TAGS].reverse()} autoTag={{ debounceMs: 10_000 }} />);
    await user.click(screen.getByRole('textbox'));
    await user.paste('please screenshot the page');
    expect(chipOrder()[0]).toBe('no-triggers');
  });

  it('turning the chip on marks the word in the tag colour', async () => {
    const { user, container } = await type('please screenshot the page');
    await user.click(screen.getByRole('button', { name: 'screenshot' }));
    await waitFor(() => expect(markOf(container, 'screenshot')).toBeTruthy());
    expect(markOf(container, 'screenshot')!.className).toContain('ds-auto-tag-mark');
  });

  it('is off unless asked for', async () => {
    const user = userEvent.setup();
    const { container } = render(<RichInput tags={TAGS} />);
    await user.click(screen.getByRole('textbox'));
    await user.paste('please screenshot the page');
    await new Promise((r) => setTimeout(r, 60));
    expect(container.querySelector('[data-at-key]')).toBeNull();
  });
});
