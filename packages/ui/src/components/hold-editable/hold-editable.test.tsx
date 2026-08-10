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

function Harness({ stash }: { tall: boolean; stash?: false }) {
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

/**
 * A group whose items hold one of each tier: plain chrome (`normal`), a link
 * (`first`), a button (`last`) and an opted-out box (`never`).
 */
function TierHarness({ onEditStart }: { onEditStart: () => void }) {
  const [cards, setCards] = useState(CARDS);
  return (
    <HoldEditable
      items={cards}
      getKey={(c) => c.id}
      onReorder={setCards}
      onEditStart={onEditStart}
      holdDelay={1000}
    >
      {(c) => (
        <div>
          <span>chrome:{c.label}</span>
          <a href="#go">link:{c.label}</a>
          <button type="button">btn:{c.label}</button>
          <div data-hold-editable-ignore="">ignore:{c.label}</div>
        </div>
      )}
    </HoldEditable>
  );
}

async function pressOn(el: Element) {
  await act(async () => {
    el.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, clientX: 10, clientY: 10 }),
    );
  });
}

async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

/** Press an item and hold past the pickup delay. */
async function holdFirstCard() {
  const body = screen.getByText('body:Cost');
  const slot = body.closest('[data-hold-editable-item]')!;
  await pressOn(slot);
  await advance(200);
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

  it('leaves edit mode on a plain tap inside the group, without activating it', async () => {
    layout(40);
    const onEditEnd = vi.fn();
    const onClick = vi.fn();
    render(
      <HoldEditable
        items={CARDS}
        getKey={(c) => c.id}
        onReorder={() => {}}
        onEditEnd={onEditEnd}
        stashLabel={(c) => c.label}
        holdDelay={100}
      >
        {(c) => (
          <button type="button" onClick={onClick}>
            body:{c.label}
          </button>
        )}
      </HoldEditable>,
    );

    await holdFirstCard();
    // Release the pickup, then let the click-suppression window lapse so the
    // next tap is a *plain* tap and not the drop's trailing click.
    await act(async () => {
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    });
    await advance(800);
    expect(document.querySelector('[data-hold-editable-stash]')).not.toBeNull();

    await act(async () => {
      screen
        .getByText('body:Commits')
        .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    expect(onEditEnd).toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();
    expect(document.querySelector('[data-hold-editable-stash]')).toBeNull();
  });
});

describe('HoldEditable hold tiers', () => {
  it('picks a link up before the OS callout would fire', async () => {
    layout(40);
    const onEditStart = vi.fn();
    render(<TierHarness onEditStart={onEditStart} />);

    await pressOn(screen.getByText('link:Cost'));
    await advance(250); // still short of linkHoldDelay (min(holdDelay, 320))
    expect(onEditStart).not.toHaveBeenCalled();
    await advance(120); // 370ms — picked up, and well before the ~500ms callout
    expect(onEditStart).toHaveBeenCalledTimes(1);
  });

  it('makes a button wait out holdDelay + interactiveHoldOffset', async () => {
    layout(40);
    const onEditStart = vi.fn();
    render(<TierHarness onEditStart={onEditStart} />);

    await pressOn(screen.getByText('btn:Cost'));
    await advance(1100); // past the normal hold — the button still owns the press
    expect(onEditStart).not.toHaveBeenCalled();
    await advance(600); // 1700ms > 1000 + 600
    expect(onEditStart).toHaveBeenCalledTimes(1);
  });

  it('never arms inside an opted-out sub-tree', async () => {
    layout(40);
    const onEditStart = vi.fn();
    render(<TierHarness onEditStart={onEditStart} />);

    await pressOn(screen.getByText('ignore:Cost'));
    await advance(5000);
    expect(onEditStart).not.toHaveBeenCalled();
  });

  it('drops a pending pickup when something scrolls under it', async () => {
    layout(40);
    const onEditStart = vi.fn();
    render(<TierHarness onEditStart={onEditStart} />);

    // The gesture this protects: a finger panning a horizontally scrollable
    // child of an item. The page never moves, the pointer barely does — only
    // the scroll event tells us this was a pan and not a hold.
    await pressOn(screen.getByText('chrome:Cost'));
    await advance(400);
    await act(async () => {
      window.dispatchEvent(new Event('scroll'));
    });
    await advance(5000);
    expect(onEditStart).not.toHaveBeenCalled();
  });

  it('drops a pending pickup when the pointer travels', async () => {
    layout(40);
    const onEditStart = vi.fn();
    render(<TierHarness onEditStart={onEditStart} />);

    await pressOn(screen.getByText('chrome:Cost'));
    await act(async () => {
      window.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          pointerType: 'touch',
          clientX: 10 + 40, // well past MOVE_CANCEL_PX
          clientY: 10,
        }),
      );
    });
    await advance(5000);
    expect(onEditStart).not.toHaveBeenCalled();
  });

  it('lets a resting mouse drift a few pixels without losing the hold', async () => {
    layout(40);
    const onEditStart = vi.fn();
    render(<TierHarness onEditStart={onEditStart} />);

    await pressOn(screen.getByText('chrome:Cost'));
    await act(async () => {
      window.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          pointerType: 'mouse',
          clientX: 10 + 12, // drift, not a drag — under MOUSE_MOVE_CANCEL_PX
          clientY: 10 + 6,
        }),
      );
    });
    await advance(1200);
    expect(onEditStart).toHaveBeenCalledTimes(1);
  });

  it('suppresses the context menu while a link press is armed', async () => {
    layout(40);
    render(<TierHarness onEditStart={() => {}} />);

    const link = screen.getByText('link:Cost');
    await pressOn(link);
    await advance(100); // armed, not yet picked up — exactly when iOS pops the callout

    const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    await act(async () => {
      link.dispatchEvent(menu);
    });
    expect(menu.defaultPrevented).toBe(true);
  });
});
