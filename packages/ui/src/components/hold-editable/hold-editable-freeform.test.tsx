import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
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

const box = (left: number, top: number, width: number, height: number): DOMRect =>
  ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  }) as DOMRect;

/**
 * jsdom has no layout, so every rect has to be invented — a column of `h`-tall
 * rows, one per slot, under a container tall enough to hold them. The stash
 * popover is parked well below everything else: it is hit-tested against the
 * live pointer during a drag, and a popover sharing the container's rect would
 * bench every item the moment it was released.
 */
function layout(h: number) {
  let seen = 0;
  const boxes = new WeakMap<Element, DOMRect>();
  HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
    if (this.hasAttribute('data-hold-editable-stash')) return box(0, 500, 300, 60);
    if (!this.hasAttribute('data-hold-editable-item')) return box(0, 0, 300, h * 3);
    let r = boxes.get(this);
    if (!r) {
      r = box(0, seen++ * h, 300, h);
      boxes.set(this, r);
    }
    return r;
  };
}

/**
 * Nested groups: a column of two cards, each holding a row of two chips. Rects
 * are derived from the element's text so measurement *order* can't shuffle
 * them — both groups measure their own slots at unpredictable moments.
 */
function layoutNested() {
  HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
    if (this.hasAttribute('data-hold-editable-stash')) return box(0, 500, 300, 60);
    if (!this.hasAttribute('data-hold-editable-item')) return box(0, 0, 300, 400);
    const text = this.textContent ?? '';
    const chip = /^([ab])(\d)$/.exec(text);
    if (chip) {
      // A row inside its card: chips side by side, 60px apart.
      return box((Number(chip[2]) - 1) * 60, (chip[1] === 'a' ? 0 : 100) + 20, 50, 20);
    }
    return box(0, /^Card B/.test(text) ? 100 : 0, 300, 90);
  };
}

async function pressAt(el: Element, x: number, y: number) {
  await act(async () => {
    el.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y }),
    );
  });
}

async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

async function release() {
  await act(async () => {
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
  });
  await advance(300); // let the drop animation retire
}

/** Hold an element, drag the pointer to (x, y), release. */
async function dragFrom(el: Element, from: [number, number], to: [number, number]) {
  await pressAt(el, from[0], from[1]);
  await advance(200);
  await act(async () => {
    window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: to[0], clientY: to[1] }));
  });
  await release();
}

const realRect = HTMLElement.prototype.getBoundingClientRect;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  HTMLElement.prototype.getBoundingClientRect = realRect;
});

/* ------------------------------------------------------------- freeform */

function FreeformHarness(props: {
  onTextChange?: (item: Card, text: string) => void;
  onAdd?: (text: string) => void;
  onEditEnd?: () => void;
}) {
  const [cards, setCards] = useState(CARDS);
  return (
    <HoldEditable
      items={cards}
      getKey={(c) => c.id}
      onReorder={setCards}
      holdDelay={100}
      freeform
      getText={(c) => c.label}
      addPlaceholder="Add option"
      {...props}
    >
      {(c) => <div>body:{c.label}</div>}
    </HoldEditable>
  );
}

/** Hold the first item, then release — the group lands in persistent edit mode. */
async function enterEditMode() {
  const slot = screen.getByText('body:Cost').closest('[data-hold-editable-item]')!;
  await pressAt(slot, 10, 10);
  await advance(200);
  await release();
}

describe('HoldEditable freeform mode', () => {
  it('renders one text input per item plus the add row', async () => {
    layout(40);
    render(<FreeformHarness onAdd={() => {}} />);
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);

    await enterEditMode();

    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    expect(inputs).toHaveLength(CARDS.length + 1);
    expect(inputs.slice(0, 3).map((i) => i.value)).toEqual([
      'Cost',
      'Estimated footprint',
      'Commits',
    ]);
    expect(screen.getByPlaceholderText('Add option')).toBeTruthy();
    // The bodies are gone: freeform collapses the group whatever its geometry.
    expect(screen.queryByText('body:Commits')).toBeNull();
  });

  it('commits an inline edit on Enter', async () => {
    layout(40);
    const onTextChange = vi.fn();
    render(<FreeformHarness onTextChange={onTextChange} />);
    await enterEditMode();

    const first = screen.getAllByRole('textbox')[0] as HTMLInputElement;
    fireEvent.change(first, { target: { value: 'Renamed' } });
    fireEvent.keyDown(first, { key: 'Enter' });

    expect(onTextChange).toHaveBeenCalledTimes(1);
    expect(onTextChange).toHaveBeenCalledWith(expect.objectContaining({ id: 'cost' }), 'Renamed');
  });

  it('submits the add row and clears it, keeping the row focused', async () => {
    layout(40);
    const onAdd = vi.fn();
    render(<FreeformHarness onAdd={onAdd} />);
    await enterEditMode();

    const add = screen.getByPlaceholderText('Add option') as HTMLInputElement;
    add.focus();
    fireEvent.change(add, { target: { value: '  New option  ' } });
    fireEvent.keyDown(add, { key: 'Enter' });

    expect(onAdd).toHaveBeenCalledWith('New option');
    expect(add.value).toBe('');
    expect(document.activeElement).toBe(add);
  });

  it('reverts an inline edit on Escape without leaving edit mode', async () => {
    layout(40);
    const onTextChange = vi.fn();
    const onEditEnd = vi.fn();
    render(<FreeformHarness onTextChange={onTextChange} onEditEnd={onEditEnd} />);
    await enterEditMode();

    const first = screen.getAllByRole('textbox')[0] as HTMLInputElement;
    fireEvent.change(first, { target: { value: 'scrapped' } });
    fireEvent.keyDown(first, { key: 'Escape' });

    expect(first.value).toBe('Cost');
    expect(onTextChange).not.toHaveBeenCalled();
    expect(onEditEnd).not.toHaveBeenCalled();
    // Still editing: the stash popover is the group-level tell.
    expect(document.querySelector('[data-hold-editable-stash]')).not.toBeNull();
  });
});

/* -------------------------------------------------------------- nesting */

interface Chip {
  id: string;
  label: string;
}
interface Group {
  id: string;
  title: string;
  chips: Chip[];
}

const GROUPS: Group[] = [
  { id: 'A', title: 'Card A', chips: [{ id: 'a1', label: 'a1' }, { id: 'a2', label: 'a2' }] },
  { id: 'B', title: 'Card B', chips: [{ id: 'b1', label: 'b1' }, { id: 'b2', label: 'b2' }] },
];

function Chips({
  chips,
  onReorder,
  onEditStart,
}: {
  chips: Chip[];
  onReorder: (chips: Chip[]) => void;
  onEditStart: () => void;
}) {
  const [order, setOrder] = useState(chips);
  return (
    <HoldEditable
      items={order}
      getKey={(c) => c.id}
      onReorder={(next) => {
        setOrder(next);
        onReorder(next);
      }}
      onEditStart={onEditStart}
      holdDelay={100}
      compactEdit={false}
      className="flex"
    >
      {(chip) => <span>{chip.label}</span>}
    </HoldEditable>
  );
}

/**
 * `compactEdit={false}` on the outer group is load-bearing: collapsing the
 * cards to label rows would unmount the inner groups, which is the opposite of
 * what these tests are about.
 */
function NestedHarness({
  onOuterReorder,
  onInnerReorder,
  onOuterEdit,
  onInnerEdit,
}: {
  onOuterReorder: (g: Group[]) => void;
  onInnerReorder: (c: Chip[]) => void;
  onOuterEdit: () => void;
  onInnerEdit: () => void;
}) {
  const [groups, setGroups] = useState(GROUPS);
  return (
    <HoldEditable
      items={groups}
      getKey={(g) => g.id}
      onReorder={(next) => {
        setGroups(next);
        onOuterReorder(next);
      }}
      onEditStart={onOuterEdit}
      holdDelay={100}
      compactEdit={false}
    >
      {(g) => (
        <div>
          <div>{g.title}</div>
          <Chips chips={g.chips} onReorder={onInnerReorder} onEditStart={onInnerEdit} />
        </div>
      )}
    </HoldEditable>
  );
}

function nestedSpies() {
  return {
    onOuterReorder: vi.fn(),
    onInnerReorder: vi.fn(),
    onOuterEdit: vi.fn(),
    onInnerEdit: vi.fn(),
  };
}

describe('HoldEditable nested groups', () => {
  it('a hold on an inner chip picks up the chip, not the card', async () => {
    layoutNested();
    const spies = nestedSpies();
    render(<NestedHarness {...spies} />);

    await pressAt(screen.getByText('a1'), 5, 25);
    await advance(200);

    expect(spies.onInnerEdit).toHaveBeenCalledTimes(1);
    expect(spies.onOuterEdit).not.toHaveBeenCalled();
  });

  it("a hold on the card's own chrome picks up the card", async () => {
    layoutNested();
    const spies = nestedSpies();
    render(<NestedHarness {...spies} />);

    await pressAt(screen.getByText('Card A'), 5, 5);
    await advance(200);

    expect(spies.onOuterEdit).toHaveBeenCalledTimes(1);
    expect(spies.onInnerEdit).not.toHaveBeenCalled();
  });

  it("the outer group's edit mode doesn't block the inner group's", async () => {
    layoutNested();
    const spies = nestedSpies();
    render(<NestedHarness {...spies} />);

    await pressAt(screen.getByText('Card A'), 5, 5);
    await advance(200);
    await release(); // the stash keeps the outer group editing after the drop
    expect(spies.onOuterEdit).toHaveBeenCalledTimes(1);

    await pressAt(screen.getByText('a1'), 5, 25);
    await advance(200);

    expect(spies.onInnerEdit).toHaveBeenCalledTimes(1);
    expect(spies.onOuterEdit).toHaveBeenCalledTimes(1); // not re-entered
  });

  it("neither group's onReorder fires for the other's drag", async () => {
    layoutNested();
    const spies = nestedSpies();
    render(<NestedHarness {...spies} />);

    // a1 → a2's slot: an inner reorder, invisible to the outer column.
    await dragFrom(screen.getByText('a1'), [5, 25], [90, 25]);
    expect(spies.onInnerReorder).toHaveBeenCalledTimes(1);
    expect(spies.onInnerReorder.mock.calls[0][0].map((c: Chip) => c.id)).toEqual(['a2', 'a1']);
    expect(spies.onOuterReorder).not.toHaveBeenCalled();

    // Card A → Card B's slot: an outer reorder, invisible to the chips.
    await dragFrom(screen.getByText('Card A'), [5, 5], [10, 160]);
    expect(spies.onOuterReorder).toHaveBeenCalledTimes(1);
    expect(spies.onOuterReorder.mock.calls[0][0].map((g: Group) => g.id)).toEqual(['B', 'A']);
    expect(spies.onInnerReorder).toHaveBeenCalledTimes(1);
  });
});
