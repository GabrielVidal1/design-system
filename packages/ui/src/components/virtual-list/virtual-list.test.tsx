import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { VirtualList } from './virtual-list';

// @tanstack/react-virtual measures the scroll container via offsetHeight, and
// renders zero rows whenever that reads 0 — which it always does in jsdom
// (there is no real layout engine). Stub a non-zero box so the virtualizer
// actually mounts a visible subset; we do not assert on real pixel positions.
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

describe('VirtualList', () => {
  it('renders a visible subset of a large list, not every row', () => {
    const items = Array.from({ length: 1000 }, (_, i) => `item-${i}`);
    render(
      <VirtualList
        items={items}
        estimateSize={60}
        className="h-96"
        renderItem={(item) => <div data-testid="row">{item}</div>}
      />,
    );
    const rows = screen.getAllByTestId('row');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(items.length);
    // The first row should be among what's mounted (nothing scrolled yet).
    expect(screen.getByText('item-0')).toBeInTheDocument();
  });

  it('sizes the inner spacer for all rows (grows with item count)', () => {
    const render10 = render(
      <VirtualList
        items={Array.from({ length: 10 }, (_, i) => `item-${i}`)}
        estimateSize={60}
        className="h-96"
        renderItem={(item) => <div>{item}</div>}
      />,
    );
    const height10 = Number(
      (render10.container.querySelector(':scope > div > div') as HTMLElement).style.height.replace('px', ''),
    );
    render10.unmount();

    const render20 = render(
      <VirtualList
        items={Array.from({ length: 20 }, (_, i) => `item-${i}`)}
        estimateSize={60}
        className="h-96"
        renderItem={(item) => <div>{item}</div>}
      />,
    );
    const height20 = Number(
      (render20.container.querySelector(':scope > div > div') as HTMLElement).style.height.replace('px', ''),
    );

    // Only the rows actually mounted (viewport + overscan) get measured to
    // their real (mocked) size; the rest keep the smaller `estimateSize`
    // guess, so this isn't a clean 2x — just confirm it grows with count.
    expect(height10).toBeGreaterThan(0);
    expect(height20).toBeGreaterThan(height10);
  });

  it('preserves the className passed to the scroll container', () => {
    const { container } = render(
      <VirtualList items={['a']} className="my-custom-scroller" renderItem={(item) => <div>{item}</div>} />,
    );
    expect(container.firstElementChild).toHaveClass('my-custom-scroller', 'overflow-y-auto');
  });

  it('renders the emptyState and no rows when items is empty', () => {
    render(
      <VirtualList items={[]} emptyState={<p>No rows</p>} renderItem={(item) => <div>{String(item)}</div>} />,
    );
    expect(screen.getByText('No rows')).toBeInTheDocument();
    expect(screen.queryByTestId('row')).not.toBeInTheDocument();
  });

  it('shows the loadingIndicator while `loading` is true, even with items present', () => {
    render(
      <VirtualList
        items={['a', 'b']}
        loading
        loadingIndicator={<div>Loading more…</div>}
        renderItem={(item) => <div>{item}</div>}
      />,
    );
    expect(screen.getByText('Loading more…')).toBeInTheDocument();
  });

  it('does not render items when loading and items is empty (loading takes priority over emptyState)', () => {
    render(
      <VirtualList
        items={[]}
        loading
        loadingIndicator={<div>Loading…</div>}
        emptyState={<p>No rows</p>}
        renderItem={(item) => <div>{String(item)}</div>}
      />,
    );
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByText('No rows')).not.toBeInTheDocument();
  });

  it('calls onEndReached as the tail of the list comes into range', () => {
    const onEndReached = vi.fn();
    const items = Array.from({ length: 5 }, (_, i) => `item-${i}`);
    render(
      <VirtualList
        items={items}
        estimateSize={60}
        endThreshold={4}
        hasMore
        onEndReached={onEndReached}
        renderItem={(item) => <div>{item}</div>}
      />,
    );
    // With only 5 short rows and a large mocked viewport, the whole list is in
    // range on first paint, so the end-reached effect should have fired.
    expect(onEndReached).toHaveBeenCalled();
  });

  it('does not call onEndReached while already loading', () => {
    const onEndReached = vi.fn();
    const items = Array.from({ length: 5 }, (_, i) => `item-${i}`);
    render(
      <VirtualList
        items={items}
        estimateSize={60}
        hasMore
        loading
        onEndReached={onEndReached}
        renderItem={(item) => <div>{item}</div>}
      />,
    );
    expect(onEndReached).not.toHaveBeenCalled();
  });
});
