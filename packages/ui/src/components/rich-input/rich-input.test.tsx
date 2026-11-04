import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { RichInput } from './rich-input';
import { ToolbarMenuRowButton } from './toolbar-menu-row';
import { unsendProgress, UNSEND_FINISH_AT, UNSEND_PLATEAU, UNSEND_PLATEAU_AT } from './parts';
import type { RichTag, RichSendButtonProps, RichSendPayload } from './types';

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

const TAGS: RichTag[] = [
  { id: 'careful', label: 'Careful', group: 'chip' },
  { id: 'proj-a', label: 'project-a', group: 'list' },
  { id: 'proj-b', label: 'project-b', group: 'list' },
  { id: 'proj-c', label: 'other-c', group: 'list' },
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

describe('RichInput duplicate tag ids', () => {
  // The caller's bug, reproduced: one id handed in twice. Two siblings sharing
  // a React key make the keyed reconcile leak a DOM node on every re-order, so
  // the scrollable list grew one more copy of the chip with each re-sort.
  const DUP_TAGS: RichTag[] = [
    { id: 'alpha', label: 'alpha', group: 'list' },
    { id: 'skill:complete', label: 'complete', group: 'list' },
    { id: 'beta', label: 'beta', group: 'list' },
    { id: 'gamma', label: 'gamma', group: 'list' },
    { id: 'skill:complete', label: 'complete (again)', group: 'list' },
    { id: 'delta', label: 'delta', group: 'list' },
  ];
  const completeChips = () => screen.queryAllByRole('button', { name: /^complete/ });

  it('renders one chip per id, however often the list re-sorts', async () => {
    const user = userEvent.setup();
    render(<RichInput cacheKey="dup1" tags={DUP_TAGS} />);
    expect(completeChips()).toHaveLength(1);
    // First occurrence wins.
    expect(completeChips()[0]).toHaveTextContent(/^complete$/);

    // Each round selects another chip and opens/closes the inline filter —
    // a re-sort (selected first) plus a filtered render, every time.
    for (const name of ['gamma', 'delta', 'beta', 'gamma', 'delta', 'beta']) {
      await user.click(screen.getByRole('button', { name }));
      await user.click(screen.getByRole('button', { name: 'Search tags' }));
      await user.type(screen.getByPlaceholderText('Filter tags…'), 'e');
      await user.keyboard('{Escape}');
      expect(completeChips()).toHaveLength(1);
    }
  });

  it('offers a duplicated id once in the # menu and sends it once', async () => {
    const user = userEvent.setup();
    let payload: RichSendPayload | null = null;
    let reported: string[] = [];
    render(
      <RichInput
        cacheKey="dup2"
        undoWindowMs={0}
        tags={DUP_TAGS}
        onTagsChange={(t) => {
          reported = t.map((x) => x.id);
        }}
        onSubmit={(p) => {
          payload = p;
        }}
        renderSendButton={(p) => <TestSendButton {...p} />}
      />,
    );

    await user.type(screen.getByRole('textbox'), 'go #skill');
    expect(screen.getAllByRole('button', { name: '#skill:complete' })).toHaveLength(1);
    await user.keyboard('{Enter}');

    expect(reported).toEqual(['skill:complete']);
    await user.click(screen.getByText('send-now'));
    expect(payload!.tags.map((t) => t.id)).toEqual(['skill:complete']);
  });

  it('keeps a tapped list chip in place until the list has a reason to re-sort', async () => {
    const user = userEvent.setup();
    render(<RichInput cacheKey="dup3" tags={TAGS} />);
    const listOrder = () =>
      screen
        .getAllByRole('button')
        .map((b) => b.textContent ?? '')
        .filter((t) => ['project-a', 'project-b', 'other-c'].includes(t));
    expect(listOrder()).toEqual(['project-a', 'project-b', 'other-c']);

    // A toggle re-renders the composer; the list must not chase the pointer.
    await user.click(screen.getByRole('button', { name: 'other-c' }));
    expect(listOrder()).toEqual(['project-a', 'project-b', 'other-c']);

    // Opening the filter is a re-sort: selected first.
    await user.click(screen.getByRole('button', { name: 'Search tags' }));
    expect(listOrder()).toEqual(['other-c', 'project-a', 'project-b']);
  });
});

describe('RichInput chip row order', () => {
  // Guidelines, in the order the caller wants them read — a child sits right
  // under its parent.
  const GUIDES: RichTag[] = [
    { id: 'g-plan', label: 'Plan first' },
    { id: 'g-tests', label: 'Write tests' },
    { id: 'g-e2e', label: 'End-to-end too', depth: 1 },
    { id: 'g-careful', label: 'Careful', triggers: ['careful'] },
    { id: 'g-docs', label: 'Update docs' },
    { id: 'g-pr', label: 'Open a PR' },
  ];
  const chipRow = () =>
    screen
      .getAllByRole('button')
      .filter((b) => b.hasAttribute('aria-pressed'))
      .map((b) => b.textContent);

  it('keeps the caller order when chips are toggled on', async () => {
    const user = userEvent.setup();
    render(<RichInput cacheKey="order1" tags={GUIDES} />);
    const input = GUIDES.map((t) => t.label);
    expect(chipRow()).toEqual(input);

    await user.click(screen.getByRole('button', { name: 'Update docs' }));
    expect(screen.getByRole('button', { name: 'Update docs' })).toHaveAttribute('aria-pressed', 'true');
    expect(chipRow()).toEqual(input);

    // A selected child stays under its parent.
    await user.click(screen.getByRole('button', { name: 'End-to-end too' }));
    expect(chipRow()).toEqual(input);
  });

  it('collapsed by showMax, still shows selected and suggested chips past the cut, in order', async () => {
    const user = userEvent.setup();
    const tags = GUIDES.map((t) => (t.id === 'g-docs' ? { ...t, defaultOn: true } : t));
    render(<RichInput cacheKey="order2" tags={tags} showMax={2} autoTag={{ debounceMs: 10 }} />);

    // First two, plus the selected chip past the cut — not pulled to the front.
    expect(chipRow()).toEqual(['Plan first', 'Write tests', 'Update docs']);
    expect(screen.getByRole('button', { name: '+3 more' })).toBeInTheDocument();

    // An auto-tag suggestion past the cut shows up too, in its own place.
    await user.click(screen.getByRole('textbox'));
    await user.paste('be careful with this');
    await waitFor(() =>
      expect(chipRow()).toEqual(['Plan first', 'Write tests', 'Careful', 'Update docs']),
    );
    expect(screen.getByRole('button', { name: '+2 more' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '+2 more' }));
    expect(chipRow()).toEqual(GUIDES.map((t) => t.label));
  });
});

describe('RichInput tag semantics', () => {
  it('hands the active tags to composePrompt and leaves the prompt to the caller', async () => {
    const user = userEvent.setup();
    let payload: RichSendPayload | null = null;
    render(
      <RichInput
        cacheKey="tg1"
        undoWindowMs={0}
        tags={TAGS}
        composePrompt={({ text, tags }) => [text, ...tags.map((t) => `<${t.id}>`)].join(' ')}
        onSubmit={(p) => {
          payload = p;
        }}
        renderSendButton={(p) => <TestSendButton {...p} />}
      />,
    );

    await user.type(screen.getByRole('textbox'), 'go');
    await user.click(screen.getByRole('button', { name: 'Careful' }));
    await user.click(screen.getByText('send-now'));

    expect(payload!.prompt).toBe('go <careful>');
    expect(payload!.tags.map((t) => t.id)).toEqual(['careful']);
  });

  it('sends the raw text when no composePrompt is given', async () => {
    const user = userEvent.setup();
    let payload: RichSendPayload | null = null;
    render(
      <RichInput
        cacheKey="tg2"
        undoWindowMs={0}
        tags={TAGS}
        onSubmit={(p) => {
          payload = p;
        }}
        renderSendButton={(p) => <TestSendButton {...p} />}
      />,
    );

    await user.type(screen.getByRole('textbox'), 'as typed  ');
    await user.click(screen.getByRole('button', { name: 'Careful' }));
    await user.click(screen.getByText('send-now'));

    expect(payload!.prompt).toBe('as typed');
  });

  it('master switch off hides the chip row and drops those tags from the payload', async () => {
    const user = userEvent.setup();
    let payload: RichSendPayload | null = null;
    render(
      <RichInput
        cacheKey="tg3"
        undoWindowMs={0}
        tags={TAGS}
        masterSwitch={{ label: 'Guidelines' }}
        onSubmit={(p) => {
          payload = p;
        }}
        renderSendButton={(p) => <TestSendButton {...p} />}
      />,
    );

    await user.type(screen.getByRole('textbox'), 'quiet');
    await user.click(screen.getByRole('button', { name: 'Careful' }));
    await user.click(screen.getByRole('button', { name: 'project-a' }));
    await user.click(screen.getByRole('button', { name: 'Guidelines on' }));

    // The chip row is gone…
    expect(screen.queryByRole('button', { name: 'Careful' })).not.toBeInTheDocument();
    // …but the list group is untouched.
    expect(screen.getByRole('button', { name: 'project-a' })).toBeInTheDocument();

    await user.click(screen.getByText('send-now'));
    expect(payload!.tags.map((t) => t.id)).toEqual(['proj-a']);
  });

  it('keeps a muted chip selected — flipping the switch back restores it', async () => {
    const user = userEvent.setup();
    render(<RichInput cacheKey="tg4" tags={TAGS} masterSwitch />);

    await user.click(screen.getByRole('button', { name: 'Careful' }));
    await user.click(screen.getByRole('button', { name: 'Tags on' }));
    await user.click(screen.getByRole('button', { name: 'Tags off' }));

    expect(screen.getByRole('button', { name: 'Careful' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('follows a caller-driven hierarchy: children appear with the parent and leave with it', async () => {
    const user = userEvent.setup();
    // The classic DAG wiring: the caller derives the visible tags from its own
    // graph and the live selection, so a child only exists while its parent is on.
    function Hierarchy() {
      const [active, setActive] = useState<string[]>([]);
      const tags: RichTag[] = [
        { id: 'parent', label: 'Parent' },
        ...(active.includes('parent')
          ? [{ id: 'child', label: 'Child', depth: 1 } satisfies RichTag]
          : []),
      ];
      return <RichInput cacheKey="tg5" tags={tags} onTagsChange={(t) => setActive(t.map((x) => x.id))} />;
    }
    render(<Hierarchy />);

    expect(screen.queryByRole('button', { name: 'Child' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Parent' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Child' })).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Child' }));
    await user.click(screen.getByRole('button', { name: 'Parent' }));
    // Parent off ⇒ the child is gone, and its selection with it.
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Child' })).not.toBeInTheDocument(),
    );
  });
});

describe('reorderable toolbar', () => {
  const orderKey = 'rich-input:toolbar:tb';
  const itemIds = (container: HTMLElement) =>
    [...container.querySelectorAll('[data-hold-editable-item]')].map(
      (el) =>
        el.querySelector('[aria-label]')?.getAttribute('aria-label') ?? 'spacer',
    );

  it('renders every control as a HoldEditable entry, spacer between the clusters', () => {
    const { container } = render(<RichInput cacheKey="tb" toolbarReorder="tb" accept="*" />);
    expect(itemIds(container)).toEqual(['Attach files', 'spacer', 'Send']);
  });

  it('applies a persisted order and benches stashed controls', () => {
    window.localStorage.setItem(
      orderKey,
      JSON.stringify({ order: ['send', 'spacer', 'attach'], stash: [] }),
    );
    const { container, unmount } = render(
      <RichInput cacheKey="tb" toolbarReorder="tb" accept="*" />,
    );
    expect(itemIds(container)).toEqual(['Send', 'spacer', 'Attach files']);
    unmount();

    window.localStorage.setItem(
      orderKey,
      JSON.stringify({ order: ['spacer', 'send'], stash: ['attach'] }),
    );
    const second = render(<RichInput cacheKey="tb" toolbarReorder="tb" accept="*" />);
    // Something benched: the + control joins the row, right before send.
    expect(itemIds(second.container)).toEqual(['spacer', 'Stashed controls (1)', 'Send']);
  });

  it('opens the benched controls from the + control, and keeps its own place', async () => {
    window.localStorage.setItem(
      orderKey,
      JSON.stringify({ order: ['more', 'spacer', 'send'], stash: ['attach'] }),
    );
    const { container } = render(<RichInput cacheKey="tb" toolbarReorder="tb" accept="*" />);
    expect(itemIds(container)).toEqual(['Stashed controls (1)', 'spacer', 'Send']);
    const menu = () => document.querySelector('[role="group"][aria-label="Stashed controls"]');
    expect(menu()?.className).toContain('hidden');
    await userEvent.click(screen.getByRole('button', { name: 'Stashed controls (1)' }));
    expect(menu()?.className).not.toContain('hidden');
    // The control as a menu row, usable from the menu.
    const row = [...(menu()?.querySelectorAll('button') ?? [])].find((b) =>
      b.textContent?.includes('Attach files'),
    );
    expect(row?.querySelector('[data-toolbar-menu-row]')).not.toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(menu()?.className).toContain('hidden'));
  });

  it("lists a stashed extra as its menuNode row, or its label beside the control", async () => {
    window.localStorage.setItem(
      orderKey,
      JSON.stringify({ order: ['more', 'spacer', 'send'], stash: ['model', 'plain'] }),
    );
    render(
      <RichInput
        cacheKey="tb"
        toolbarReorder="tb"
        toolbarExtraItems={[
          {
            id: 'model',
            label: 'Model',
            node: <button type="button">opus chip</button>,
            menuNode: <ToolbarMenuRowButton label="Model" value="Opus" chevron />,
          },
          { id: 'plain', label: 'Plain', node: <button type="button">plain chip</button> },
        ]}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Stashed controls (2)' }));
    const menu = document.querySelector('[role="group"][aria-label="Stashed controls"]')!;
    const model = menu.querySelector('[data-toolbar-menu-item="model"]')!;
    // The row, not the toolbar chip.
    expect(model.textContent).toContain('Opus');
    expect(model.textContent).not.toContain('opus chip');
    // No menuNode: still a row — the label, then the control itself.
    const plain = menu.querySelector('[data-toolbar-menu-item="plain"]')!;
    expect(plain.textContent).toBe('Plainplain chip');
  });

  it('has no + control while nothing is benched', () => {
    window.localStorage.setItem(orderKey, JSON.stringify({ order: ['more', 'send'], stash: [] }));
    const { container } = render(<RichInput cacheKey="tb" toolbarReorder="tb" accept="*" />);
    expect(itemIds(container)).not.toContain('Stashed controls (0)');
    expect(document.querySelector('[aria-label="Stashed controls"]')).toBeNull();
  });

  it('never benches the send button, even if the stored stash says so', () => {
    window.localStorage.setItem(
      orderKey,
      JSON.stringify({ order: [], stash: ['send'] }),
    );
    const { container } = render(<RichInput cacheKey="tb" toolbarReorder="tb" accept="*" />);
    expect(itemIds(container)).toContain('Send');
  });
});

describe('un-send sweep curve', () => {
  it('starts fast, holds near full, then snaps to full as the send fires', () => {
    expect(unsendProgress(0)).toBe(0);
    // The fast start: most of the way across well before the plateau.
    expect(unsendProgress(UNSEND_PLATEAU_AT / 3)).toBeGreaterThan(0.6);
    expect(unsendProgress(UNSEND_PLATEAU_AT)).toBeCloseTo(UNSEND_PLATEAU);
    // The plateau.
    expect(unsendProgress(0.7)).toBe(UNSEND_PLATEAU);
    expect(unsendProgress(UNSEND_FINISH_AT)).toBe(UNSEND_PLATEAU);
    // The exponential finish: barely moving at first, full at the end.
    const mid = unsendProgress((UNSEND_FINISH_AT + 1) / 2);
    expect(mid - UNSEND_PLATEAU).toBeLessThan((1 - UNSEND_PLATEAU) * 0.1);
    expect(unsendProgress(1)).toBe(1);
    // Monotonic all the way.
    let prev = -1;
    for (let i = 0; i <= 100; i++) {
      const p = unsendProgress(i / 100);
      expect(p).toBeGreaterThanOrEqual(prev);
      prev = p;
    }
  });
});

describe('RichInput on-screen keyboard', () => {
  // jsdom has no visualViewport, so the keyboard always reads as hidden — the
  // Android case: keyboard dismissed by the back gesture, textarea still focused.
  it('keeps focus and the keyboard down when a chip is tapped', async () => {
    render(<RichInput tags={TAGS} />);
    const ta = screen.getByRole('textbox');
    ta.focus();
    const chip = screen.getByRole('button', { name: 'Careful' });

    fireEvent.pointerDown(chip, { pointerType: 'touch' });
    expect(ta).toHaveAttribute('inputmode', 'none');
    // The touch-synthesised mousedown is cancelled: focus never leaves the text.
    expect(fireEvent.mouseDown(chip)).toBe(false);
    fireEvent.click(chip);
    expect(ta).toHaveFocus();
    expect(chip).toHaveAttribute('aria-pressed', 'true');

    // Tapping the text asks for the keyboard back.
    fireEvent.pointerDown(ta, { pointerType: 'touch' });
    expect(ta).not.toHaveAttribute('inputmode');
  });

  it('leaves mouse clicks and a blurred textarea alone', () => {
    render(<RichInput tags={TAGS} />);
    const ta = screen.getByRole('textbox');
    const chip = screen.getByRole('button', { name: 'Careful' });

    ta.focus();
    fireEvent.pointerDown(chip, { pointerType: 'mouse' });
    expect(ta).not.toHaveAttribute('inputmode');

    ta.blur();
    fireEvent.pointerDown(chip, { pointerType: 'touch' });
    expect(ta).not.toHaveAttribute('inputmode');
  });

  it('restores the input mode when the textarea loses focus', () => {
    render(<RichInput tags={TAGS} />);
    const ta = screen.getByRole('textbox');
    ta.focus();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Careful' }), { pointerType: 'touch' });
    expect(ta).toHaveAttribute('inputmode', 'none');
    ta.blur();
    expect(ta).not.toHaveAttribute('inputmode');
  });
});

describe('RichInput un-send lock', () => {
  afterEach(() => vi.useRealTimers());

  const cancelButton = () => screen.getByRole('button', { name: /tap to cancel/ });

  it('locks the composer on the sent text and fires once the window runs out', () => {
    vi.useFakeTimers();
    const sent: RichSendPayload[] = [];
    render(
      <RichInput
        undoWindowMs={3000}
        onSubmit={(p) => void sent.push(p)}
        renderSendButton={(p) => <TestSendButton {...p} />}
      />,
    );
    const ta = screen.getByRole('textbox');
    fireEvent.change(ta, { target: { value: 'hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'send-now' }));

    // Held: the text stays, read-only, under the overlay — nothing went out.
    expect(ta).toHaveValue('hello');
    expect(ta).toHaveAttribute('readonly');
    expect(cancelButton()).toHaveAccessibleName(/3s/);
    expect(screen.getByRole('button', { name: 'send-now' })).toBeDisabled();
    expect(sent).toHaveLength(0);

    act(() => vi.advanceTimersByTime(3000));
    expect(sent.map((p) => p.text)).toEqual(['hello']);
    expect(ta).toHaveValue('');
    expect(ta).not.toHaveAttribute('readonly');
    expect(screen.queryByRole('button', { name: /tap to cancel/ })).toBeNull();
  });

  it('a tap on the overlay cancels: the draft is editable again and never sent', () => {
    vi.useFakeTimers();
    const sent: RichSendPayload[] = [];
    render(
      <RichInput
        undoWindowMs={3000}
        tags={TAGS}
        onSubmit={(p) => void sent.push(p)}
        renderSendButton={(p) => <TestSendButton {...p} />}
      />,
    );
    const ta = screen.getByRole('textbox');
    fireEvent.change(ta, { target: { value: 'take it back' } });
    fireEvent.click(screen.getByRole('button', { name: 'Careful' }));
    fireEvent.click(screen.getByRole('button', { name: 'send-now' }));

    // The chip it went out with still reads as selected while held.
    expect(screen.getByRole('button', { name: 'Careful' })).toHaveAttribute('aria-pressed', 'true');

    act(() => vi.advanceTimersByTime(1000));
    fireEvent.click(cancelButton());
    expect(ta).toHaveValue('take it back');
    expect(ta).not.toHaveAttribute('readonly');
    expect(screen.getByRole('button', { name: 'Careful' })).toHaveAttribute('aria-pressed', 'true');

    act(() => vi.advanceTimersByTime(5000));
    expect(sent).toHaveLength(0);
  });

  it('Escape cancels the held send', () => {
    vi.useFakeTimers();
    const onSubmit = vi.fn();
    render(
      <RichInput
        undoWindowMs={3000}
        onSubmit={onSubmit}
        renderSendButton={(p) => <TestSendButton {...p} />}
      />,
    );
    const ta = screen.getByRole('textbox');
    fireEvent.change(ta, { target: { value: 'oops' } });
    fireEvent.click(screen.getByRole('button', { name: 'send-now' }));
    fireEvent.keyDown(ta, { key: 'Escape' });

    expect(ta).toHaveValue('oops');
    expect(screen.queryByRole('button', { name: /tap to cancel/ })).toBeNull();
    act(() => vi.advanceTimersByTime(5000));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('locks on a caller-held send and resumes its sweep from `startedAt`', () => {
    vi.useFakeTimers();
    const onCancel = vi.fn();
    render(
      <RichInput
        undoWindowMs={0}
        held={{ text: 'held outside', startedAt: Date.now() - 2000, durationMs: 3000, onCancel }}
      />,
    );
    const ta = screen.getByRole('textbox');
    expect(ta).toHaveValue('held outside');
    expect(ta).toHaveAttribute('readonly');
    // Two of the three seconds were already spent before this mount.
    expect(cancelButton()).toHaveAccessibleName(/1s/);

    fireEvent.click(cancelButton());
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('RichInput spellcheck', () => {
  /** jsdom has no matchMedia; answer `(pointer: coarse)` as a phone would. */
  function stubPointer(coarse: boolean) {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: coarse && query === '(pointer: coarse)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
  }

  afterEach(() => vi.unstubAllGlobals());

  it('keeps the browser spellcheck with a mouse', () => {
    stubPointer(false);
    render(<RichInput />);
    expect(screen.getByRole('textbox')).toHaveAttribute('spellcheck', 'true');
  });

  it('turns it off on a touchscreen, where the misspelling menu steals the keyboard', () => {
    stubPointer(true);
    render(<RichInput />);
    expect(screen.getByRole('textbox')).toHaveAttribute('spellcheck', 'false');
  });

  it('lets the caller force it either way', () => {
    stubPointer(true);
    const { unmount } = render(<RichInput spellCheck />);
    expect(screen.getByRole('textbox')).toHaveAttribute('spellcheck', 'true');
    unmount();
    stubPointer(false);
    render(<RichInput spellCheck={false} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('spellcheck', 'false');
  });
});
