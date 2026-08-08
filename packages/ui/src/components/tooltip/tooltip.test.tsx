import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Tooltip } from './tooltip';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Tooltip', () => {
  it('shows on hover after a delay and hides on leave', () => {
    render(
      <Tooltip content="Delete">
        <button>Trash</button>
      </Tooltip>,
    );
    const trigger = screen.getByRole('button', { name: 'Trash' });

    fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(screen.getByRole('tooltip')).toHaveTextContent('Delete');

    fireEvent.pointerLeave(trigger, { pointerType: 'mouse' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('does not show on a touch hover (no pointerenter follows a tap)', () => {
    render(
      <Tooltip content="Delete">
        <button>Trash</button>
      </Tooltip>,
    );
    fireEvent.pointerEnter(screen.getByRole('button'), { pointerType: 'touch' });
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('dismisses on Escape', () => {
    render(
      <Tooltip content="Delete">
        <button>Trash</button>
      </Tooltip>,
    );
    fireEvent.pointerEnter(screen.getByRole('button'), { pointerType: 'mouse' });
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('a quick tap fires the trigger and never reveals the tooltip', () => {
    const onClick = vi.fn();
    render(
      <Tooltip content="Delete">
        <button onClick={onClick}>Trash</button>
      </Tooltip>,
    );
    const trigger = screen.getByRole('button');

    fireEvent.pointerDown(trigger, { pointerType: 'touch', clientX: 0, clientY: 0 });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    fireEvent.pointerUp(trigger, { pointerType: 'touch' });
    fireEvent.click(trigger);

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('a long press reveals the tooltip and swallows the ensuing tap', () => {
    const onClick = vi.fn();
    render(
      <Tooltip content="Delete">
        <button onClick={onClick}>Trash</button>
      </Tooltip>,
    );
    const trigger = screen.getByRole('button');

    fireEvent.pointerDown(trigger, { pointerType: 'touch', clientX: 0, clientY: 0 });
    act(() => {
      vi.advanceTimersByTime(450);
    });
    expect(screen.getByRole('tooltip')).toHaveTextContent('Delete');

    fireEvent.pointerUp(trigger, { pointerType: 'touch' });
    fireEvent.click(trigger);
    expect(onClick).not.toHaveBeenCalled();

    // Auto-dismisses after the linger window rather than staying pinned open.
    act(() => {
      vi.advanceTimersByTime(1600);
    });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('cancels the pending long press when the finger moves (a scroll, not a hold)', () => {
    render(
      <Tooltip content="Delete">
        <button>Trash</button>
      </Tooltip>,
    );
    const trigger = screen.getByRole('button');

    fireEvent.pointerDown(trigger, { pointerType: 'touch', clientX: 0, clientY: 0 });
    fireEvent.pointerMove(trigger, { pointerType: 'touch', clientX: 40, clientY: 0 });
    act(() => {
      vi.advanceTimersByTime(450);
    });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('keyboard focus shows it immediately', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(
      <Tooltip content="Delete">
        <button>Trash</button>
      </Tooltip>,
    );
    await user.tab();
    expect(screen.getByRole('button')).toHaveFocus();
    expect(screen.getByRole('tooltip')).toHaveTextContent('Delete');
  });
});
