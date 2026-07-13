import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Dock } from './dock';
import { DockProvider } from './dock-context';
import { FloatingPanel } from './floating-panel';

function Two({ closable = true }: { closable?: boolean }) {
  return (
    <DockProvider>
      <FloatingPanel id="composer" dockId="bottom" title="Composer" closable={closable}>
        <div>composer body</div>
      </FloatingPanel>
      <FloatingPanel id="terminal" dockId="bottom" title="Terminal" closable={closable}>
        <div>terminal body</div>
      </FloatingPanel>
      <Dock id="bottom" />
    </DockProvider>
  );
}

const plus = () => screen.queryByRole('button', { name: /open .*(panel|composer|terminal)/i });

describe('FloatingPanel closable + Dock "+"', () => {
  it('closes a docked panel into the dock\'s "+" and reopens it there', async () => {
    const user = userEvent.setup();
    render(<Two />);

    // Both docked: two tabs, active body shown, nothing to reopen yet.
    expect(screen.getByText('composer body')).toBeInTheDocument();
    expect(plus()).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Close Composer' }));

    // Closed: body gone (not kept mounted), and a "+" appears to bring it back.
    expect(screen.queryByText('composer body')).not.toBeInTheDocument();
    expect(plus()).toBeInTheDocument();

    // One panel closed → "+" reopens it directly, no menu.
    await user.click(plus()!);
    expect(screen.getByText('composer body')).toBeInTheDocument();
    expect(plus()).toBeNull();
  });

  it('offers a menu when several panels are closed, and opens the picked one', async () => {
    const user = userEvent.setup();
    render(<Two />);

    await user.click(screen.getByRole('button', { name: 'Close Composer' }));
    await user.click(screen.getByRole('button', { name: 'Close Terminal' }));

    // Dock is now just its "+" strip — no panel body left.
    expect(screen.queryByText('composer body')).not.toBeInTheDocument();
    expect(screen.queryByText('terminal body')).not.toBeInTheDocument();

    await user.click(plus()!);
    await user.click(screen.getByRole('menuitem', { name: 'Terminal' }));

    expect(screen.getByText('terminal body')).toBeInTheDocument();
    expect(screen.queryByText('composer body')).not.toBeInTheDocument();
  });

  it('keeps the body mounted across close/reopen with keepMounted', async () => {
    const user = userEvent.setup();
    render(
      <DockProvider>
        <FloatingPanel id="composer" dockId="bottom" title="Composer" closable keepMounted>
          <input aria-label="draft" defaultValue="" />
        </FloatingPanel>
        <Dock id="bottom" />
      </DockProvider>,
    );

    await user.type(screen.getByLabelText('draft'), 'half-typed');
    await user.click(screen.getByRole('button', { name: 'Close Composer' }));
    await user.click(plus()!);

    expect(screen.getByLabelText('draft')).toHaveValue('half-typed');
  });

  it('starts closed with defaultClosed, reachable only from "+"', () => {
    render(
      <DockProvider>
        <FloatingPanel id="terminal" dockId="bottom" title="Terminal" closable defaultClosed>
          <div>terminal body</div>
        </FloatingPanel>
        <Dock id="bottom" />
      </DockProvider>,
    );

    expect(screen.queryByText('terminal body')).not.toBeInTheDocument();
    expect(plus()).toBeInTheDocument();
  });

  it('reports closing and reopening through onPlacementChange', async () => {
    const user = userEvent.setup();
    const modes: string[] = [];
    render(
      <DockProvider>
        <FloatingPanel
          id="terminal"
          dockId="bottom"
          title="Terminal"
          closable
          onPlacementChange={(p) => modes.push(p.mode)}
        >
          <div>terminal body</div>
        </FloatingPanel>
        <Dock id="bottom" />
      </DockProvider>,
    );

    // The initial placement is not a change — nothing reported yet.
    expect(modes).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Close Terminal' }));
    await user.click(plus()!);

    expect(modes).toEqual(['closed', 'docked']);
  });
});
