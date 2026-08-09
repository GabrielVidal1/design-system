import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { RichInput } from './rich-input';
import type { GuidelineTag, RichSendButtonProps } from './types';

// @tanstack/react-virtual (behind the drafts dropdown's FuzzyList) measures the
// scroll container via offsetHeight and renders nothing when it reads 0 — which
// is always, in jsdom. Give every element a non-zero box so rows mount.
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    value: 600,
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    value: 600,
  });
});

const TAGS: GuidelineTag[] = [
  { id: 'careful', label: 'Careful', prompt: 'Be careful.', group: 'guideline' },
  { id: 'proj-a', label: 'project-a', group: 'tag' },
  { id: 'proj-b', label: 'project-b', group: 'tag' },
  { id: 'proj-c', label: 'other-c', group: 'tag' },
];

/** A send button that surfaces `saveDraft` as a plain button (the built-in one
 * needs a long-press, which jsdom timers make flaky to drive). */
function TestSendButton({ canSend, submit, saveDraft }: RichSendButtonProps) {
  return (
    <>
      <button type="button" disabled={!canSend} onClick={submit}>
        send-now
      </button>
      <button type="button" onClick={saveDraft}>
        stash-draft
      </button>
    </>
  );
}

const draftsKey = (key: string) => `rich-input:drafts:${key}`;

afterEach(() => window.localStorage.clear());

describe('RichInput drafts', () => {
  it('saves a draft (text + tags), clears the composer, and restores it from the menu', async () => {
    const user = userEvent.setup();
    render(
      <RichInput
        cacheKey="t1"
        tags={TAGS}
        renderSendButton={(p) => <TestSendButton {...p} />}
      />,
    );

    await user.type(screen.getByRole('textbox'), 'draft me');
    await user.click(screen.getByRole('button', { name: 'project-a' }));
    await user.click(screen.getByText('stash-draft'));

    // Composer cleared, draft stored with its tag selection.
    expect(screen.getByRole('textbox')).toHaveValue('');
    const stored = JSON.parse(window.localStorage.getItem(draftsKey('t1')) ?? '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].text).toBe('draft me');
    expect(stored[0].tags).toContain('proj-a');

    // The drafts button appears once a draft exists; the dropdown lists it.
    const shelf = screen.getByRole('button', { name: 'Drafts (1)' });
    await user.click(shelf);
    await user.click(screen.getByText('draft me'));

    // Restored: text and tag selection back, the shelf empties away.
    expect(screen.getByRole('textbox')).toHaveValue('draft me');
    expect(screen.getByRole('button', { name: 'project-a' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.queryByRole('button', { name: /Drafts/ })).not.toBeInTheDocument();
  });

  it('swaps: picking a draft stashes what is currently typed', async () => {
    const user = userEvent.setup();
    render(
      <RichInput cacheKey="t2" tags={TAGS} renderSendButton={(p) => <TestSendButton {...p} />} />,
    );

    await user.type(screen.getByRole('textbox'), 'first');
    await user.click(screen.getByText('stash-draft'));
    await user.type(screen.getByRole('textbox'), 'second');

    await user.click(screen.getByRole('button', { name: 'Drafts (1)' }));
    await user.click(screen.getByText('first'));

    expect(screen.getByRole('textbox')).toHaveValue('first');
    const stored = JSON.parse(window.localStorage.getItem(draftsKey('t2')) ?? '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].text).toBe('second');
  });

  it('captures and restores caller extra state with each draft', async () => {
    const user = userEvent.setup();
    let restored: unknown = null;
    render(
      <RichInput
        cacheKey="t3"
        renderSendButton={(p) => <TestSendButton {...p} />}
        draftExtra={() => ({ model: 'fable-5' })}
        onDraftRestore={(extra) => {
          restored = extra;
        }}
      />,
    );

    await user.type(screen.getByRole('textbox'), 'with extra');
    await user.click(screen.getByText('stash-draft'));
    await user.click(screen.getByRole('button', { name: 'Drafts (1)' }));
    await user.click(screen.getByText('with extra'));

    expect(restored).toEqual({ model: 'fable-5' });
  });

  it('deletes a draft from the dropdown without restoring it', async () => {
    const user = userEvent.setup();
    render(
      <RichInput cacheKey="t4" renderSendButton={(p) => <TestSendButton {...p} />} />,
    );
    await user.type(screen.getByRole('textbox'), 'doomed');
    await user.click(screen.getByText('stash-draft'));

    await user.click(screen.getByRole('button', { name: 'Drafts (1)' }));
    await user.click(screen.getByRole('button', { name: 'Delete draft' }));

    expect(window.localStorage.getItem(draftsKey('t4'))).toBe('[]');
    expect(screen.getByRole('textbox')).toHaveValue('');
  });
});

describe('RichInput live-draft tag persistence', () => {
  it('persists the tag selection with the cached draft and restores it on remount', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<RichInput cacheKey="t5" tags={TAGS} />);

    await user.type(screen.getByRole('textbox'), 'hello');
    await user.click(screen.getByRole('button', { name: 'project-b' }));

    // The record write is debounced.
    await waitFor(() => {
      const raw = window.localStorage.getItem('rich-input:draft:t5');
      expect(raw && JSON.parse(raw)).toMatchObject({ text: 'hello', tags: ['proj-b'] });
    });

    unmount();
    render(<RichInput cacheKey="t5" tags={TAGS} />);
    expect(screen.getByRole('textbox')).toHaveValue('hello');
    expect(screen.getByRole('button', { name: 'project-b' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('still reads a legacy plain-string draft', () => {
    window.localStorage.setItem('rich-input:draft:t6', 'old style');
    render(<RichInput cacheKey="t6" />);
    expect(screen.getByRole('textbox')).toHaveValue('old style');
  });
});

describe('RichInput async submit', () => {
  it('shows sending, then settles quietly when the async onSubmit resolves', async () => {
    const user = userEvent.setup();
    let resolve!: () => void;
    const onSubmit = () =>
      new Promise<void>((r) => {
        resolve = r;
      });
    render(
      <RichInput
        cacheKey="t9"
        undoWindowMs={0}
        onSubmit={onSubmit}
        renderSendButton={(p) => (
          <button type="button" disabled={!p.canSend} onClick={p.submit}>
            {p.sending ? 'sending…' : 'send-now'}
          </button>
        )}
      />,
    );

    await user.type(screen.getByRole('textbox'), 'off it goes');
    await user.click(screen.getByText('send-now'));

    // In flight: composer cleared, button reports sending.
    expect(screen.getByRole('textbox')).toHaveValue('');
    expect(screen.getByText('sending…')).toBeInTheDocument();

    resolve();
    await waitFor(() => expect(screen.getByText('send-now')).toBeInTheDocument());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('surfaces a rejection as a dismissible error and restores the text', async () => {
    const user = userEvent.setup();
    const onSubmit = () => Promise.reject(new Error('spawn failed'));
    render(
      <RichInput
        cacheKey="t10"
        undoWindowMs={0}
        onSubmit={onSubmit}
        renderSendButton={(p) => <TestSendButton {...p} />}
      />,
    );

    await user.type(screen.getByRole('textbox'), 'doomed send');
    await user.click(screen.getByText('send-now'));

    // The error notification appears and the composer gets its text back.
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('spawn failed'));
    expect(screen.getByRole('textbox')).toHaveValue('doomed send');

    await user.click(screen.getByRole('button', { name: 'Dismiss error' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('TagScrollList search & ordering', () => {
  it('orders selected tags first (snapshotted at mount)', () => {
    window.localStorage.setItem(
      'rich-input:draft:t7',
      JSON.stringify({ text: 'x', tags: ['proj-c'] }),
    );
    render(<RichInput cacheKey="t7" tags={TAGS} />);
    const chips = screen
      .getAllByRole('button', { pressed: false })
      .concat(screen.getAllByRole('button', { pressed: true }))
      .map((b) => b.textContent);
    // The selected chip renders before its unselected siblings in the DOM.
    const list = screen.getAllByRole('button').map((b) => b.textContent ?? '');
    expect(list.indexOf('other-c')).toBeLessThan(list.indexOf('project-a'));
    expect(chips).toContain('other-c');
  });

  it('filters the tag list from the inline search', async () => {
    const user = userEvent.setup();
    render(<RichInput cacheKey="t8" tags={TAGS} />);

    await user.click(screen.getByRole('button', { name: 'Search tags' }));
    await user.type(screen.getByPlaceholderText('Filter tags…'), 'project');

    expect(screen.getByRole('button', { name: 'project-a' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'project-b' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'other-c' })).not.toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'other-c' })).toBeInTheDocument();
  });
});
