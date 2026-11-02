import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { RichInput } from './rich-input';
import { carryMatches, findAutoTagMatches } from './use-auto-tag';
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

describe('carryMatches', () => {
  const text = 'screenshot then nanobanana';
  const hits = at(text);

  it('keeps a hit before the edit and shifts one after it', () => {
    const next = 'screenshot and then nanobanana';
    const carried = carryMatches(hits, text, next);
    expect(carried.map((m) => next.slice(m.start, m.end))).toEqual(['screenshot', 'nanobanana']);
  });

  it('drops a hit the edit lands in', () => {
    const carried = carryMatches(hits, text, 'screenshot then nanoXbanana');
    expect(carried.map((m) => m.tag.label)).toEqual(['screenshot']);
  });

  it('drops a hit the edit grows into a longer word', () => {
    expect(carryMatches(at('a screenshot'), 'a screenshot', 'a screenshots')).toEqual([]);
    expect(carryMatches(at('a screenshot'), 'a screenshot', 'a screenshot ')).toHaveLength(1);
  });

  it('hands back the same array when nothing moved', () => {
    expect(carryMatches(hits, text, text)).toBe(hits);
    expect(carryMatches(hits, text, `${text} and more`)).toBe(hits);
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

  it('keeps the floated tag in front while the typing resumes', async () => {
    const user = userEvent.setup();
    render(<RichInput tags={[...TAGS].reverse()} autoTag={{ debounceMs: 50 }} />);
    await user.click(screen.getByRole('textbox'));
    await user.paste('please screenshot the page');
    await waitFor(() => expect(chipOrder()[0]).toBe('screenshot'));
    await user.type(screen.getByRole('textbox'), ' now');
    expect(chipOrder()[0]).toBe('screenshot');
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

describe("RichInput tagList='link'", () => {
  const LINK_TAGS: RichTag[] = [
    { id: 'proj-a', label: 'project-a', group: 'list' },
    { id: 'proj-b', label: 'project-b', group: 'list', defaultOn: true },
    ...TAGS,
  ];
  const setup = () => {
    const user = userEvent.setup();
    render(
      <RichInput
        tags={LINK_TAGS}
        tagList="link"
        tagLinkLabel="Link resources"
        autoTag={{ debounceMs: 10 }}
      />,
    );
    return user;
  };
  const shown = (name: string) => screen.queryByRole('button', { name });

  it('shows the link pill and the selected tags, not the whole list', () => {
    setup();
    expect(shown('Link resources')).toBeTruthy();
    expect(shown('project-b')?.getAttribute('aria-pressed')).toBe('true');
    expect(shown('project-a')).toBeNull();
    expect(shown('nanobanana')).toBeNull();
  });

  it('shows a matched tag dashed, and a tap links it in place', async () => {
    const user = setup();
    await user.click(screen.getByRole('textbox'));
    await user.paste('please take a screenshot');
    await waitFor(() => expect(shown('screenshot')).toBeTruthy());
    const chip = shown('screenshot')!;
    expect(chip.getAttribute('aria-pressed')).toBe('false');
    expect(chip.className).toContain('border-dashed');
    await user.click(chip);
    expect(shown('screenshot')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('opens the filter from the pill; Enter links the first match, Escape folds it', async () => {
    const user = setup();
    await user.click(shown('Link resources')!);
    const filter = screen.getByRole('textbox', { name: 'Link resources' });
    // The unfolded list offers every tag.
    expect(shown('project-a')).toBeTruthy();
    await user.type(filter, 'nano{Enter}');
    expect(
      screen.getAllByRole('button', { name: 'nanobanana' }).some((b) => b.getAttribute('aria-pressed') === 'true'),
    ).toBe(true);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('textbox', { name: 'Link resources' })).toBeNull();
    expect(shown('project-a')).toBeNull();
    expect(shown('nanobanana')?.getAttribute('aria-pressed')).toBe('true');
  });
});
