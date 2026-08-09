import { useState } from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HoldEditable } from './hold-editable';

interface Card {
  id: string;
  label: string;
}

const CARDS: Card[] = [
  { id: 'cost', label: 'Cost' },
  { id: 'footprint', label: 'Estimated footprint' },
  { id: 'commits', label: 'Commits' },
];

/**
 * jsdom has no layout: every rect is 0×0, which reads as "a group of tiny
 * items" and would never trigger compact edit mode. Lay the slots out as a
 * column of `h`-tall rows so the geometry the component measures is real.
 */
function layout(h: number) {
  let seen = 0;
  const boxes = new WeakMap<Element, DOMRect>();
  HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
    // The container (and anything else) is one tall box; each slot wrapper is
    // a row stacked under the previous one.
    if (!this.hasAttribute('data-hold-editable-item')) {
      return { left: 0, top: 0, width: 300, height: h * 3, right: 300, bottom: h * 3, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
    }
    let r = boxes.get(this);
    if (!r) {
      const top = seen++ * h;
      r = { left: 0, top, width: 300, height: h, right: 300, bottom: top + h, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
      boxes.set(this, r);
    }
    return r;
  };
}

function Harness({ tall, stash }: { tall: boolean; stash?: false }) {
  const [cards, setCards] = useState(CARDS);
  return (
    <HoldEditable
      items={cards}
      getKey={(c) => c.id}
      onReorder={setCards}
      stash={stash}
      stashLabel={(c) => c.label}
      compactLabel={(c) => c.label}
      holdDelay={100}
    >
      {(c) => <div>body:{c.label}</div>}
    </HoldEditable>
  );
}

/** Press an item and hold past the pickup delay. */
async function holdFirstCard() {
  const body = screen.getByText('body:Cost');
  const slot = body.closest('[data-hold-editable-item]')!;
  await act(async () => {
    slot.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, clientX: 10, clientY: 10 }),
    );
  });
  await act(async () => {
    vi.advanceTimersByTime(200);
  });
}

const realRect = HTMLElement.prototype.getBoundingClientRect;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  HTMLElement.prototype.getBoundingClientRect = realRect;
});

describe('HoldEditable', () => {
  it('opens the stash popover on the first pickup, with no stash prop', async () => {
    layout(40);
    render(<Harness tall={false} />);
    expect(document.querySelector('[data-hold-editable-stash]')).toBeNull();
    await holdFirstCard();
    expect(document.querySelector('[data-hold-editable-stash]')).not.toBeNull();
    expect(screen.getByText('drag an item here to stash it')).toBeTruthy();
  });

  it('stash={false} keeps the group bench-less', async () => {
    layout(40);
    render(<Harness tall={false} stash={false} />);
    await holdFirstCard();
    expect(document.querySelector('[data-hold-editable-stash]')).toBeNull();
  });

  it('collapses tall list items to label rows while editing', async () => {
    layout(200); // taller than COMPACT_TRIGGER_PX
    render(<Harness tall />);
    expect(screen.getByText('body:Commits')).toBeTruthy();
    await holdFirstCard();
    // Every item — not just the held one — is now a label row.
    expect(screen.queryByText('body:Commits')).toBeNull();
    expect(screen.getAllByText('Commits').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Estimated footprint').length).toBeGreaterThan(0);
  });

  it('leaves short list items alone', async () => {
    layout(40); // under the trigger — dragging these is already comfortable
    render(<Harness tall={false} />);
    await holdFirstCard();
    expect(screen.getByText('body:Commits')).toBeTruthy();
  });
});
