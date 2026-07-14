import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { VirtualList, type VirtualListHandle } from './virtual-list';

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

  describe('grid mode (columns)', () => {
    it('lays items out in rows of N and passes the flat index to renderItem', () => {
      const items = Array.from({ length: 6 }, (_, i) => `item-${i}`);
      const { container } = render(
        <VirtualList
          items={items}
          columns={3}
          estimateSize={200}
          className="h-96"
          renderItem={(item, i) => <div data-testid="cell">{`${item}@${i}`}</div>}
        />,
      );

      // 6 items over 3 columns = 2 measured rows, each a CSS grid of 3 tracks.
      const gridRows = container.querySelectorAll('[data-index] > div[style*="grid-template-columns"]');
      expect(gridRows).toHaveLength(2);
      expect((gridRows[0] as HTMLElement).style.gridTemplateColumns).toBe('repeat(3, minmax(0, 1fr))');

      // Every item is rendered, and each gets its index in the FLAT list — the
      // second row starts at 3, not back at 0.
      expect(screen.getAllByTestId('cell')).toHaveLength(6);
      expect(screen.getByText('item-0@0')).toBeInTheDocument();
      expect(screen.getByText('item-3@3')).toBeInTheDocument();
      expect(screen.getByText('item-5@5')).toBeInTheDocument();
    });

    it('leaves a short trailing row short rather than padding it', () => {
      const items = Array.from({ length: 5 }, (_, i) => `item-${i}`);
      render(
        <VirtualList
          items={items}
          columns={3}
          estimateSize={200}
          className="h-96"
          renderItem={(item) => <div data-testid="cell">{item}</div>}
        />,
      );
      // 5 items over 3 columns: a full row + a row of 2. No blank filler cells.
      expect(screen.getAllByTestId('cell')).toHaveLength(5);
    });

    it('renders no grid wrapper at all when columns is 1 (the list path is unchanged)', () => {
      const { container } = render(
        <VirtualList
          items={['a', 'b']}
          columns={1}
          className="h-96"
          renderItem={(item) => <div data-testid="row">{item}</div>}
        />,
      );
      expect(container.querySelectorAll('[style*="grid-template-columns"]')).toHaveLength(0);
      expect(screen.getAllByTestId('row')).toHaveLength(2);
    });

    it('windows a large grid — mounts a subset of rows, not every card', () => {
      const items = Array.from({ length: 1200 }, (_, i) => `item-${i}`);
      render(
        <VirtualList
          items={items}
          columns={4}
          estimateSize={220}
          className="h-96"
          renderItem={(item) => <div data-testid="cell">{item}</div>}
        />,
      );
      const cells = screen.getAllByTestId('cell');
      expect(cells.length).toBeGreaterThan(0);
      expect(cells.length).toBeLessThan(items.length);
      expect(screen.getByText('item-0')).toBeInTheDocument();
    });

    it('exposes the live column count on the handle, and scrollToIndex takes an ITEM index', () => {
      const api = createRef<VirtualListHandle>();
      render(
        <VirtualList
          items={Array.from({ length: 40 }, (_, i) => `item-${i}`)}
          columns={4}
          estimateSize={200}
          className="h-96"
          apiRef={api}
          renderItem={(item) => <div>{item}</div>}
        />,
      );
      expect(api.current?.columnCount).toBe(4);
      // Item 9 lives on row 2 — the mapping is the component's job, so callers
      // (e.g. FuzzyList's keyboard cursor) keep thinking in flat item indices.
      expect(() => api.current?.scrollToIndex(9)).not.toThrow();
    });

    it('resolves a responsive columns map against the viewport', () => {
      // jsdom reports every media query as non-matching, so the `base` entry is
      // the one that applies — i.e. the phone layout is what we assert here.
      const items = Array.from({ length: 4 }, (_, i) => `item-${i}`);
      const { container } = render(
        <VirtualList
          items={items}
          columns={{ base: 2, md: 3, lg: 4 }}
          estimateSize={200}
          className="h-96"
          renderItem={(item) => <div>{item}</div>}
        />,
      );
      const gridRows = container.querySelectorAll('[data-index] > div[style*="grid-template-columns"]');
      expect((gridRows[0] as HTMLElement).style.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))');
      expect(gridRows).toHaveLength(2); // 4 items / 2 columns
    });
  });
});
