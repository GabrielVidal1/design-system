import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it } from 'vitest';

import { RichInput } from './rich-input';
import { findAutoTagMatches } from './use-auto-tag';
import type { RichTag } from './types';

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    value: 600,
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    value: 600,
  });
  // The overlay points its ring and its buttons at boxes it measures off the
  // mirror. jsdom does no layout and reports none, and the component correctly
  // draws nothing when it has nothing to point at — so give the mirrored spans
  // a box, or there is no call to action to click in these tests.
  const rect = { x: 8, y: 4, left: 8, top: 4, width: 64, height: 22, right: 72, bottom: 26 };
  Object.defineProperty(Element.prototype, 'getClientRects', {
    configurable: true,
    value(this: Element) {
      return this instanceof HTMLElement && this.dataset.atKey ? [rect] : [];
    },
  });
});

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
  const type = async (text: string) => {
    const user = userEvent.setup();
    render(<RichInput tags={TAGS} autoTag={{ debounceMs: 10 }} />);
    await user.click(screen.getByRole('textbox'));
    await user.paste(text);
    return user;
  };

  it('offers an accept/refuse pair once the typing settles', async () => {
    await type('please screenshot the page');
    await waitFor(() => expect(screen.getByLabelText('Add tag screenshot')).toBeTruthy());
    expect(screen.getByLabelText('Dismiss suggested tag screenshot')).toBeTruthy();
  });

  it('offers nothing until the debounce elapses', () => {
    render(<RichInput tags={TAGS} autoTag={{ debounceMs: 10_000 }} />);
    expect(screen.queryByLabelText('Add tag screenshot')).toBeNull();
  });

  it('accepting selects the tag and retires the call to action', async () => {
    const user = await type('please screenshot the page');
    await waitFor(() => expect(screen.getByLabelText('Add tag screenshot')).toBeTruthy());
    await user.click(screen.getByLabelText('Add tag screenshot'));
    await waitFor(() => expect(screen.queryByLabelText('Add tag screenshot')).toBeNull());
    // The chip is now on — the tag list renders it pressed.
    const chip = screen.getAllByRole('button', { name: /screenshot/ })[0];
    expect(chip.getAttribute('aria-pressed')).toBe('true');
  });

  it('refusing drops it, and the same word does not ask again', async () => {
    const user = await type('please screenshot the page');
    await waitFor(() => expect(screen.getByLabelText('Add tag screenshot')).toBeTruthy());
    await user.click(screen.getByLabelText('Dismiss suggested tag screenshot'));
    await waitFor(() => expect(screen.queryByLabelText('Add tag screenshot')).toBeNull());
    await user.paste(' and screenshot again');
    // Give the debounce a chance to re-run over the longer text.
    await new Promise((r) => setTimeout(r, 60));
    expect(screen.queryByLabelText('Add tag screenshot')).toBeNull();
  });

  it('is off unless asked for', async () => {
    const user = userEvent.setup();
    render(<RichInput tags={TAGS} />);
    await user.click(screen.getByRole('textbox'));
    await user.paste('please screenshot the page');
    await new Promise((r) => setTimeout(r, 60));
    expect(screen.queryByLabelText('Add tag screenshot')).toBeNull();
  });
});
