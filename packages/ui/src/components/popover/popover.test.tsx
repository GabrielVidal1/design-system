import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Popover } from './popover';

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

describe('Popover', () => {
  it('opens on trigger click and closes on a second click', async () => {
    const user = userEvent.setup();
    render(
      <Popover trigger={<button>Open</button>}>
        <p>Panel content</p>
      </Popover>,
    );
    expect(screen.queryByText('Panel content')).not.toBeInTheDocument();
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger());
    expect(screen.getByText('Panel content')).toBeInTheDocument();
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');

    await user.click(trigger());
    expect(screen.queryByText('Panel content')).not.toBeInTheDocument();
  });

  it('closes when a click lands outside', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <Popover trigger={<button>Open</button>}>
          <p>Panel content</p>
        </Popover>
        <p>elsewhere</p>
      </div>,
    );
    await user.click(trigger());
    expect(screen.getByText('Panel content')).toBeInTheDocument();
    await user.click(screen.getByText('elsewhere'));
    expect(screen.queryByText('Panel content')).not.toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    render(
      <Popover trigger={<button>Open</button>}>
        <p>Panel content</p>
      </Popover>,
    );
    await user.click(trigger());
    await user.keyboard('{Escape}');
    expect(screen.queryByText('Panel content')).not.toBeInTheDocument();
  });

  it('opens as a bottom sheet dialog on phones', async () => {
    stubMobile(true);
    const user = userEvent.setup();
    render(
      <Popover trigger={<button>Open</button>} label="Options">
        <p>Panel content</p>
      </Popover>,
    );
    await user.click(trigger());
    expect(screen.getByRole('dialog', { name: 'Options' })).toBeInTheDocument();
    expect(screen.getByText('Panel content')).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('is controllable: open/onOpenChange drive it instead of internal state', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <Popover trigger={<button>Open</button>} open={false} onOpenChange={onOpenChange}>
        <p>Panel content</p>
      </Popover>,
    );
    await user.click(trigger());
    expect(onOpenChange).toHaveBeenCalledWith(true);
    // Still closed — the consumer hasn't flipped the controlled prop yet.
    expect(screen.queryByText('Panel content')).not.toBeInTheDocument();

    rerender(
      <Popover trigger={<button>Open</button>} open onOpenChange={onOpenChange}>
        <p>Panel content</p>
      </Popover>,
    );
    expect(screen.getByText('Panel content')).toBeInTheDocument();
  });
});
