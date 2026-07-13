import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Modal } from './modal';

function Harness({ initialOpen = false }: { initialOpen?: boolean }) {
  const [open, setOpen] = React.useState(initialOpen);
  return (
    <div>
      <button onClick={() => setOpen(true)}>Open trigger</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Hello">
        <button>Inside</button>
      </Modal>
    </div>
  );
}

afterEach(() => {
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';
});

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(<Modal open={false} onClose={() => {}} title="Hi" />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders into a portal on document.body with dialog semantics', () => {
    render(<Modal open onClose={() => {}} title="Hi" />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    // Portalled straight onto body, not inside the render container.
    expect(dialog.closest('body')).toBe(document.body);
  });

  it('closes on Escape when dismissable', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} title="Hi" />);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close on Escape when dismissable=false', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Hi" dismissable={false}>
        content
      </Modal>,
    );
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('moves focus into the panel on open (to its first focusable child)', async () => {
    render(<Modal open onClose={() => {}} title="Hi" />);
    const dialog = screen.getByRole('dialog');
    await waitFor(() => {
      expect(dialog.contains(document.activeElement)).toBe(true);
      expect(document.activeElement).not.toBe(document.body);
    });
    // The close button is the panel's first focusable element.
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' }));
  });

  it('focuses the panel itself when it has no focusable children', async () => {
    render(
      <Modal open onClose={() => {}} hideHeader dismissable={false}>
        <p>static content, nothing focusable</p>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog');
    await waitFor(() => expect(document.activeElement).toBe(dialog));
  });

  it('restores focus to the trigger on close', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByText('Open trigger');
    trigger.focus();
    await user.click(trigger);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true));

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('locks body scroll while open and releases it on close', () => {
    const { rerender } = render(<Modal open onClose={() => {}} title="Hi" />);
    expect(document.body.style.overflow).toBe('hidden');

    rerender(<Modal open={false} onClose={() => {}} title="Hi" />);
    expect(document.body.style.overflow).toBe('');
  });

  it('scroll lock is ref-counted: closing one of two stacked modals keeps the lock, closing both releases it', async () => {
    const user = userEvent.setup();
    function Two() {
      const [aOpen, setAOpen] = React.useState(true);
      const [bOpen, setBOpen] = React.useState(true);
      return (
        <>
          <Modal open={aOpen} onClose={() => setAOpen(false)} title="A" />
          <Modal open={bOpen} onClose={() => setBOpen(false)} title="B" />
          <button onClick={() => setAOpen(false)}>close-a</button>
          <button onClick={() => setBOpen(false)}>close-b</button>
        </>
      );
    }
    render(<Two />);
    expect(document.body.style.overflow).toBe('hidden');

    await user.click(screen.getByText('close-a'));
    expect(document.body.style.overflow).toBe('hidden');

    await user.click(screen.getByText('close-b'));
    expect(document.body.style.overflow).toBe('');
  });
});
