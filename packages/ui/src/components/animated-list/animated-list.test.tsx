import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AnimatedList } from './animated-list';

// jsdom has no layout: fake one. Rows stack 50px apart inside the list, and the
// whole page sits `scroll` px above the viewport — exactly what a scroll does
// to every `getBoundingClientRect().top` at once.
const ROW = 50;
let scroll = 0;

function fakeRect(this: HTMLElement): DOMRect {
  let top = -scroll;
  if (this.classList.contains('ds-animated-row')) {
    top += Array.from(this.parentElement!.children).indexOf(this) * ROW;
  }
  return { top, bottom: top + ROW, left: 0, right: 0, width: 0, height: ROW, x: 0, y: top } as DOMRect;
}

const rows = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>('.ds-animated-row'));

function List({ items, tick = 0 }: { items: string[]; tick?: number }) {
  return (
    <AnimatedList
      items={items}
      getItemKey={(i) => i}
      renderItem={(i) => (
        <span>
          {i} · {tick}
        </span>
      )}
    />
  );
}

describe('AnimatedList', () => {
  beforeEach(() => {
    scroll = 0;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(fakeRect);
  });
  afterEach(() => vi.restoreAllMocks());

  it('glides rows that actually reorder', () => {
    const { container, rerender } = render(<List items={['a', 'b']} />);
    rerender(<List items={['b', 'a']} />);
    const [b, a] = rows(container);
    expect(b.style.transform).toBe(`translateY(${ROW}px)`);
    expect(a.style.transform).toBe(`translateY(${-ROW}px)`);
  });

  it('does not treat a page scroll as a move', () => {
    const { container, rerender } = render(<List items={['a', 'b']} />);
    // The page scrolls, then a row re-renders (a ticking timer) in place.
    scroll = 300;
    rerender(<List items={['a', 'b']} tick={1} />);
    for (const row of rows(container)) expect(row.style.transform).toBe('');
  });
});
