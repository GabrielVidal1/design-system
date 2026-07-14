import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { FuzzyList } from './fuzzy-list';

// @tanstack/react-virtual measures the scroll container via offsetHeight and
// renders nothing when it reads 0 — which is always, in jsdom (no real
// layout). Give every element a non-zero box so the virtualizer actually
// mounts rows; real sizing/positioning is out of scope in this environment.
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

interface Row {
  name: string;
  desc: string;
}

const items: Row[] = [
  { name: 'apple pie', desc: 'a dessert' },
  { name: 'banana bread', desc: 'also a dessert' },
  { name: 'utils.ts', desc: 'a parser helper file' },
  { name: 'parser.ts', desc: 'the actual parser' },
];

function renderList(props: Partial<ComponentProps<typeof FuzzyList<Row>>> = {}) {
  return render(
    <FuzzyList<Row>
      items={items}
      keys={['name', 'desc']}
      debounce={0}
      getItemKey={(item) => item.name}
      renderItem={({ item, highlight, select }) => (
        <div onClick={select} data-testid={`row-${item.name}`}>
          <span data-testid={`name-${item.name}`}>{highlight('name')}</span>
        </div>
      )}
      {...props}
    />,
  );
}

describe('FuzzyList', () => {
  it('renders every item with no query', () => {
    renderList();
    for (const item of items) {
      expect(screen.getByTestId(`row-${item.name}`)).toBeInTheDocument();
    }
    expect(screen.getByText('4 items')).toBeInTheDocument();
  });

  it('fuzzy-matches and narrows the list as you type', async () => {
    const user = userEvent.setup();
    renderList();
    await user.type(screen.getByPlaceholderText('Search…'), 'apple');
    expect(screen.getByTestId('row-apple pie')).toBeInTheDocument();
    expect(screen.queryByTestId('row-banana bread')).not.toBeInTheDocument();
  });

  it('highlights the matched substring in <mark>', async () => {
    const user = userEvent.setup();
    renderList();
    await user.type(screen.getByPlaceholderText('Search…'), 'apple');
    const row = screen.getByTestId('name-apple pie');
    expect(row.querySelector('mark')).not.toBeNull();
  });

  it('shows the "N of M" count line once a query narrows the results', async () => {
    const user = userEvent.setup();
    renderList();
    await user.type(screen.getByPlaceholderText('Search…'), 'apple');
    expect(screen.getByText('1 of 4')).toBeInTheDocument();
  });

  it('a quoted phrase requires an exact, case-insensitive substring match', async () => {
    const user = userEvent.setup();
    renderList();
    // "utils.ts" should exact-match only the row that literally contains it,
    // even though fuzzy matching alone might rank other rows too.
    await user.type(screen.getByPlaceholderText('Search…'), '"utils.ts"');
    expect(screen.getByTestId('row-utils.ts')).toBeInTheDocument();
    expect(screen.queryByTestId('row-parser.ts')).not.toBeInTheDocument();
    expect(screen.queryByTestId('row-apple pie')).not.toBeInTheDocument();
  });

  it('mixes a fuzzy term with a quoted exact phrase', async () => {
    const user = userEvent.setup();
    renderList();
    // Fuzzy "parser" matches both parser.ts and utils.ts (whose desc mentions
    // "parser"); the exact phrase "parser.ts" then keeps only the literal hit.
    await user.type(screen.getByPlaceholderText('Search…'), 'parser "parser.ts"');
    expect(screen.getByTestId('row-parser.ts')).toBeInTheDocument();
    expect(screen.queryByTestId('row-utils.ts')).not.toBeInTheDocument();
  });

  it('shows the emptyState when nothing matches', async () => {
    const user = userEvent.setup();
    renderList({ emptyState: 'Nothing here' });
    await user.type(screen.getByPlaceholderText('Search…'), 'zzzzzznomatch');
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('calls onSelect when a row is clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderList({ onSelect });
    await user.click(screen.getByTestId('row-apple pie'));
    expect(onSelect).toHaveBeenCalledWith(items[0], 0);
  });

  it('calls onQueryChange with the live (un-debounced) query on every keystroke', async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    renderList({ onQueryChange });
    await user.type(screen.getByPlaceholderText('Search…'), 'ap');
    expect(onQueryChange).toHaveBeenCalledWith('a');
    expect(onQueryChange).toHaveBeenCalledWith('ap');
  });

  describe('smooth reorder passthrough', () => {
    it('does not animate rows by default', () => {
      const { container } = renderList();
      expect(container.querySelectorAll('.ds-virtual-row--smooth')).toHaveLength(0);
    });

    it('forwards `smooth` (and its pace) to the underlying VirtualList', () => {
      const { container } = renderList({
        smooth: true,
        smoothDuration: 700,
        smoothEasing: 'linear',
      });
      const rows = container.querySelectorAll('.ds-virtual-row--smooth');
      expect(rows.length).toBeGreaterThan(0);
      const row = rows[0] as HTMLElement;
      expect(row.style.getPropertyValue('--ds-virtual-row-duration')).toBe('700ms');
      expect(row.style.getPropertyValue('--ds-virtual-row-ease')).toBe('linear');
    });

    it('keeps the VirtualList defaults when only `smooth` is set', () => {
      const { container } = renderList({ smooth: true });
      const row = container.querySelector('.ds-virtual-row--smooth') as HTMLElement;
      expect(row.style.getPropertyValue('--ds-virtual-row-duration')).toBe('520ms');
      expect(row.style.getPropertyValue('--ds-virtual-row-ease')).toBe('cubic-bezier(0.65, 0, 0.35, 1)');
    });

    it('holds the DOM order steady as a query re-ranks the results', async () => {
      // Re-ranking is a reorder like any other: the rows must keep their DOM
      // slots so the transition survives (see the VirtualList tests).
      const user = userEvent.setup();
      const { container } = renderList({ smooth: true });
      const nodes = () => [...container.querySelectorAll('.ds-virtual-row')];
      const before = nodes();

      await user.type(screen.getByPlaceholderText('Search…'), 'parser');
      await screen.findByTestId('row-parser.ts');

      // The surviving rows are the same DOM nodes, in the same sibling order —
      // Fuse re-ranked them, but React did not move a single element.
      const after = nodes();
      const kept = after.filter((n) => before.includes(n));
      expect(kept).toEqual(before.filter((n) => after.includes(n)));
    });
  });
});
