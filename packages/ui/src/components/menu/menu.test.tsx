import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ContextMenu, Menu, type MenuEntry } from './menu';

const mql = (matches: boolean) =>
  ({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as MediaQueryList;

const stubMobile = (mobile: boolean) => {
  vi.stubGlobal('matchMedia', (q: string) => mql(mobile && q.includes('max-width')));
};

const trigger = () => screen.getByRole('button', { name: 'Open' });

const items = (onDelete: () => void): MenuEntry[] => [
  { id: 'rename', label: 'Rename' },
  { type: 'separator' },
  { id: 'archive', label: 'Archive', disabled: true },
  { id: 'delete', label: 'Delete', danger: true, onSelect: onDelete },
];

describe('Menu', () => {
  it('opens on trigger click, selects an item, and closes', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(<Menu trigger={<button>Open</button>} items={items(onDelete)} />);

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    await user.click(trigger());
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('does not fire onSelect for a disabled item', async () => {
    const user = userEvent.setup();
    const onArchive = vi.fn();
    const entries: MenuEntry[] = [
      { id: 'archive', label: 'Archive', disabled: true, onSelect: onArchive },
    ];
    render(<Menu trigger={<button>Open</button>} items={entries} />);
    await user.click(trigger());
    await user.click(screen.getByRole('menuitem', { name: 'Archive' }));
    expect(onArchive).not.toHaveBeenCalled();
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('navigates with arrow keys and selects with Enter, skipping disabled items', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(<Menu trigger={<button>Open</button>} items={items(onDelete)} />);
    await user.click(trigger());
    // rename (0) -> archive is disabled, skipped -> delete
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    render(<Menu trigger={<button>Open</button>} items={items(vi.fn())} />);
    await user.click(trigger());
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens as a bottom sheet dialog on phones', async () => {
    stubMobile(true);
    const user = userEvent.setup();
    render(<Menu trigger={<button>Open</button>} items={items(vi.fn())} label="Actions" />);
    await user.click(trigger());
    expect(screen.getByRole('dialog', { name: 'Actions' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});

describe('ContextMenu', () => {
  it('opens on right-click at the pointer and selects an item', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(
      <ContextMenu items={items(onDelete)}>
        <div>Card</div>
      </ContextMenu>,
    );
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    await user.pointer({ keys: '[MouseRight]', target: screen.getByText('Card') });
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes when a click lands outside', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <ContextMenu items={items(vi.fn())}>
          <div>Card</div>
        </ContextMenu>
        <p>elsewhere</p>
      </div>,
    );
    await user.pointer({ keys: '[MouseRight]', target: screen.getByText('Card') });
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await user.click(screen.getByText('elsewhere'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('never opens when disabled', async () => {
    const user = userEvent.setup();
    render(
      <ContextMenu items={items(vi.fn())} disabled>
        <div>Card</div>
      </ContextMenu>,
    );
    await user.pointer({ keys: '[MouseRight]', target: screen.getByText('Card') });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens as a bottom sheet dialog on phones', async () => {
    stubMobile(true);
    const user = userEvent.setup();
    render(
      <ContextMenu items={items(vi.fn())} label="Card actions">
        <div>Card</div>
      </ContextMenu>,
    );
    await user.pointer({ keys: '[MouseRight]', target: screen.getByText('Card') });
    expect(screen.getByRole('dialog', { name: 'Card actions' })).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});
