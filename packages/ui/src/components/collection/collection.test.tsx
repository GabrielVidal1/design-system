import type { ComponentProps } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { Collection } from './collection';

// @tanstack/react-virtual measures the scroll container via offsetHeight and
// renders nothing when it reads 0 — which is always, in jsdom (no real layout).
// Give every element a non-zero box so rows actually mount.
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 600 });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 600 });
});

beforeEach(() => {
  window.localStorage.clear();
});

interface Photo {
  id: string;
  name: string;
  album: string;
  url: string;
}

const photos: Photo[] = [
  { id: 'a', name: 'alpine reservoir', album: 'landscapes', url: '/a.jpg' },
  { id: 'b', name: 'timber and rail', album: 'landscapes', url: '/b.jpg' },
  { id: 'c', name: 'study of a hound', album: 'animals', url: '/c.jpg' },
];

function renderCollection(props: Partial<ComponentProps<typeof Collection<Photo>>> = {}) {
  return render(
    <Collection<Photo>
      items={photos}
      getTitle={(p) => p.name}
      getSubtitle={(p) => p.album}
      getImage={(p) => p.url}
      getItemKey={(p) => p.id}
      listClassName="h-96"
      {...props}
    />,
  );
}

/** The grid wrapper VirtualList emits only in cards mode. */
const gridRows = (c: HTMLElement) => c.querySelectorAll('[style*="grid-template-columns"]');

describe('Collection', () => {
  it('renders every item with its title and subtitle', () => {
    renderCollection();
    for (const p of photos) {
      expect(screen.getByText(p.name)).toBeInTheDocument();
    }
    expect(screen.getAllByText('landscapes')).toHaveLength(2);
  });

  it('defaults to cards — a grid — and switches to a single-column list on toggle', async () => {
    const user = userEvent.setup();
    const { container } = renderCollection();

    // Cards: VirtualList lays rows out as a CSS grid.
    expect(gridRows(container).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'List view' }));

    // List: no grid wrapper at all, but the same items are still there.
    expect(gridRows(container)).toHaveLength(0);
    expect(screen.getByText('alpine reservoir')).toBeInTheDocument();
  });

  it('marks the active view on the toggle', async () => {
    const user = userEvent.setup();
    renderCollection();
    const cardsBtn = screen.getByRole('button', { name: 'Card view' });
    const listBtn = screen.getByRole('button', { name: 'List view' });

    expect(cardsBtn).toHaveAttribute('aria-pressed', 'true');
    expect(listBtn).toHaveAttribute('aria-pressed', 'false');

    await user.click(listBtn);
    expect(cardsBtn).toHaveAttribute('aria-pressed', 'false');
    expect(listBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('honours defaultView', () => {
    const { container } = renderCollection({ defaultView: 'list' });
    expect(gridRows(container)).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'List view' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('is controllable — `view` wins and the toggle only reports intent', async () => {
    const user = userEvent.setup();
    const onViewChange = vi.fn();
    const { container } = renderCollection({ view: 'cards', onViewChange });

    await user.click(screen.getByRole('button', { name: 'List view' }));

    expect(onViewChange).toHaveBeenCalledWith('list');
    // Still cards: the parent owns the state and hasn't changed the prop.
    expect(gridRows(container).length).toBeGreaterThan(0);
  });

  it('persists the chosen view under persistKey and restores it on remount', async () => {
    const user = userEvent.setup();
    const first = renderCollection({ persistKey: 'photos.view' });

    await user.click(screen.getByRole('button', { name: 'List view' }));
    expect(gridRows(first.container)).toHaveLength(0);
    first.unmount();

    // A fresh mount reads the stored preference rather than the default.
    const second = renderCollection({ persistKey: 'photos.view' });
    expect(gridRows(second.container)).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'List view' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls onSelect with the clicked item', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderCollection({ onSelect });

    await user.click(screen.getByText('study of a hound'));

    expect(onSelect).toHaveBeenCalledWith(photos[2], 2);
  });

  it('lets renderCard / renderRow replace the built-in item, per view', async () => {
    const user = userEvent.setup();
    renderCollection({
      renderCard: ({ item }) => <div>card:{item.name}</div>,
      renderRow: ({ item }) => <div>row:{item.name}</div>,
    });

    expect(screen.getByText('card:alpine reservoir')).toBeInTheDocument();
    expect(screen.queryByText('row:alpine reservoir')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'List view' }));

    expect(screen.getByText('row:alpine reservoir')).toBeInTheDocument();
    expect(screen.queryByText('card:alpine reservoir')).not.toBeInTheDocument();
  });

  it('renders the meta and actions slots, and tells them which view they are in', () => {
    renderCollection({
      renderMeta: ({ view }) => <span>meta-in-{view}</span>,
      renderActions: ({ item }) => <button type="button">del-{item.id}</button>,
    });
    expect(screen.getAllByText('meta-in-cards')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'del-a' })).toBeInTheDocument();
  });

  it('shows the empty state when there are no items', () => {
    renderCollection({ items: [], emptyState: <p>No photos yet</p> });
    expect(screen.getByText('No photos yet')).toBeInTheDocument();
  });

  it('shows skeletons instead of items while loading', () => {
    renderCollection({ loading: true });
    expect(screen.queryByText('alpine reservoir')).not.toBeInTheDocument();
    // The toggle stays usable so the layout doesn't jump when items land.
    expect(screen.getByRole('button', { name: 'Card view' })).toBeInTheDocument();
  });

  it('keeps the search box mounted while loading, so a typed query survives a refetch', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <Collection<Photo>
        items={[]}
        loading
        getTitle={(p) => p.name}
        searchKeys={['name']}
        debounce={0}
        listClassName="h-96"
      />,
    );

    // The box exists *during* the load — not only once the items land.
    const box = screen.getByPlaceholderText('Search…');
    await user.type(box, 'hound');

    // Items arrive; the query the user typed is still in the box and applied.
    rerender(
      <Collection<Photo>
        items={photos}
        loading={false}
        getTitle={(p) => p.name}
        searchKeys={['name']}
        debounce={0}
        listClassName="h-96"
      />,
    );
    expect(screen.getByPlaceholderText('Search…')).toHaveValue('hound');
  });

  it('hides the toggle when asked', () => {
    renderCollection({ hideToggle: true });
    expect(screen.queryByRole('button', { name: 'Card view' })).not.toBeInTheDocument();
    expect(screen.getByText('alpine reservoir')).toBeInTheDocument();
  });

  it('does not leak the view between two un-persisted collections on one page', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Collection<Photo>
          items={photos}
          getTitle={(p) => p.name}
          getItemKey={(p) => `x-${p.id}`}
          toolbar={<span>first</span>}
          listClassName="h-96"
        />
        <Collection<Photo>
          items={photos}
          getTitle={(p) => p.name}
          getItemKey={(p) => `y-${p.id}`}
          toolbar={<span>second</span>}
          listClassName="h-96"
        />
      </>,
    );

    // Flip only the first one to list view…
    const listButtons = screen.getAllByRole('button', { name: 'List view' });
    await user.click(listButtons[0]);

    // …the second must still be on cards. (Both are un-persisted, so neither may
    // pick up the other's choice through a shared localStorage key.)
    expect(listButtons[0]).toHaveAttribute('aria-pressed', 'true');
    expect(listButtons[1]).toHaveAttribute('aria-pressed', 'false');
  });

  describe('with searchKeys (composed with FuzzyList)', () => {
    it('grows a search box that filters the items, keeping the toggle', async () => {
      const user = userEvent.setup();
      const { container } = renderCollection({ searchKeys: ['name', 'album'], debounce: 0 });

      const box = screen.getByPlaceholderText('Search…');
      expect(screen.getByRole('button', { name: 'Card view' })).toBeInTheDocument();

      await user.type(box, 'hound');

      // The matched title is split across a <mark>, so assert on the text content
      // of the list rather than on a single element.
      await waitFor(() => expect(container.textContent).toContain('study of a hound'));
      expect(container.textContent).not.toContain('alpine reservoir');
    });

    it('still toggles between cards and list while searching', async () => {
      const user = userEvent.setup();
      const { container } = renderCollection({ searchKeys: ['name'], debounce: 0 });

      expect(gridRows(container).length).toBeGreaterThan(0);
      await user.click(screen.getByRole('button', { name: 'List view' }));
      expect(gridRows(container)).toHaveLength(0);
      expect(screen.getByText('alpine reservoir')).toBeInTheDocument();
    });

    it('highlights the match inside the item, via the shared renderer', async () => {
      const user = userEvent.setup();
      const { container } = renderCollection({ searchKeys: ['name'], debounce: 0 });

      await user.type(screen.getByPlaceholderText('Search…'), 'hound');

      const mark = await within(container).findByText('hound', { selector: 'mark' });
      expect(mark).toBeInTheDocument();
    });

    it('highlights through a DOTTED key path, the way Fuse resolves keys', async () => {
      const user = userEvent.setup();
      interface Nested {
        id: string;
        meta: { name: string };
      }
      const nested: Nested[] = [
        { id: 'a', meta: { name: 'alpine reservoir' } },
        { id: 'b', meta: { name: 'study of a hound' } },
      ];
      const { container } = render(
        <Collection<Nested>
          items={nested}
          getTitle={(p) => p.meta.name}
          getItemKey={(p) => p.id}
          titleKey="meta.name"
          searchKeys={['meta.name']}
          debounce={0}
          listClassName="h-96"
        />,
      );

      await user.type(screen.getByPlaceholderText('Search…'), 'hound');

      // A flat `item['meta.name']` lookup would find nothing and silently skip
      // the highlight — the path has to be walked.
      expect(await within(container).findByText('hound', { selector: 'mark' })).toBeInTheDocument();
    });

    it('distinguishes "no items" from "nothing matched your search"', async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <Collection<Photo>
          items={photos}
          getTitle={(p) => p.name}
          searchKeys={['name']}
          debounce={0}
          emptyState={<p>No photos yet</p>}
          noMatchesState={<p>Nothing matched</p>}
          listClassName="h-96"
        />,
      );

      // A full collection whose search matches nothing: "nothing matched".
      await user.type(screen.getByPlaceholderText('Search…'), 'zzzzzz');
      expect(await screen.findByText('Nothing matched')).toBeInTheDocument();
      expect(screen.queryByText('No photos yet')).not.toBeInTheDocument();

      // An actually-empty collection: "no photos yet".
      rerender(
        <Collection<Photo>
          items={[]}
          getTitle={(p) => p.name}
          searchKeys={['name']}
          debounce={0}
          emptyState={<p>No photos yet</p>}
          noMatchesState={<p>Nothing matched</p>}
          listClassName="h-96"
        />,
      );
      expect(await screen.findByText('No photos yet')).toBeInTheDocument();
    });

    it('selects the keyboard-focused item on Enter', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const { container } = renderCollection({
        searchKeys: ['name'],
        debounce: 0,
        onSelect,
        defaultView: 'list',
      });

      await user.type(screen.getByPlaceholderText('Search…'), 'hound');
      await waitFor(() => expect(container.textContent).toContain('study of a hound'));
      await user.keyboard('{Enter}');

      // The cursor starts on the first (only) result — the hound.
      expect(onSelect).toHaveBeenCalledWith(photos[2], 2);
    });
  });
});
