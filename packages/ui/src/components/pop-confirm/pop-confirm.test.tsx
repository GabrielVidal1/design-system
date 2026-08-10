import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PopConfirm } from './pop-confirm';

const QUESTION = 'Delete this note?';

const trigger = () => screen.getByRole('button', { name: 'Delete' });
// The OK button grows an sr-only "Loading" while pending, so match loosely.
const ok = () => screen.getByRole('button', { name: /Yes/ });
const cancel = () => screen.getByRole('button', { name: 'No' });

describe('PopConfirm', () => {
  it('opens the bubble on trigger click', async () => {
    const user = userEvent.setup();
    render(<PopConfirm trigger={<button>Delete</button>} title={QUESTION} description="This cannot be undone." />);
    expect(screen.queryByText(QUESTION)).not.toBeInTheDocument();

    await user.click(trigger());
    expect(screen.getByText(QUESTION)).toBeInTheDocument();
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
    expect(ok()).toBeInTheDocument();
    expect(cancel()).toBeInTheDocument();
  });

  it('OK calls onConfirm and closes', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<PopConfirm trigger={<button>Delete</button>} title={QUESTION} onConfirm={onConfirm} />);

    await user.click(trigger());
    await user.click(ok());
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(QUESTION)).not.toBeInTheDocument();
  });

  it('Cancel calls onCancel and closes', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <PopConfirm trigger={<button>Delete</button>} title={QUESTION} onConfirm={onConfirm} onCancel={onCancel} />,
    );

    await user.click(trigger());
    await user.click(cancel());
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByText(QUESTION)).not.toBeInTheDocument();
  });

  it('treats Escape as a cancel', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<PopConfirm trigger={<button>Delete</button>} title={QUESTION} onCancel={onCancel} />);

    await user.click(trigger());
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(QUESTION)).not.toBeInTheDocument();
  });

  it('holds the bubble open with a loading OK until an async onConfirm settles', async () => {
    const user = userEvent.setup();
    let settle: () => void = () => {};
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          settle = resolve;
        }),
    );
    render(<PopConfirm trigger={<button>Delete</button>} title={QUESTION} onConfirm={onConfirm} />);

    await user.click(trigger());
    await user.click(ok());
    expect(ok()).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText(QUESTION)).toBeInTheDocument();

    await act(async () => {
      settle();
    });
    await waitFor(() => expect(screen.queryByText(QUESTION)).not.toBeInTheDocument());
  });

  it('bypasses everything when disabled: the trigger just acts normally', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onConfirm = vi.fn();
    render(
      <PopConfirm
        disabled
        trigger={<button onClick={onClick}>Delete</button>}
        title={QUESTION}
        onConfirm={onConfirm}
      />,
    );

    await user.click(trigger());
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByText(QUESTION)).not.toBeInTheDocument();
    expect(trigger()).not.toHaveAttribute('aria-expanded');
  });
});
