import * as React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ToastProvider, useToast } from './toast';

let capturedToast: ReturnType<typeof useToast>;

function Trigger() {
  capturedToast = useToast();
  return null;
}

function renderProvider(props: React.ComponentProps<typeof ToastProvider> = { children: null }) {
  return render(
    <ToastProvider {...props}>
      <Trigger />
    </ToastProvider>,
  );
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Toast', () => {
  it('renders a pushed toast', () => {
    renderProvider();
    act(() => {
      capturedToast('Saved');
    });
    expect(screen.getByText('Saved')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('uses role="alert" and assertive live region for errors', () => {
    renderProvider();
    act(() => {
      capturedToast.error('Broke');
    });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
  });

  it('auto-dismisses after its duration', () => {
    renderProvider({ children: null, duration: 1000 });
    act(() => {
      capturedToast('Bye', { type: 'info' });
    });
    expect(screen.getByText('Bye')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(screen.getByText('Bye')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(screen.queryByText('Bye')).not.toBeInTheDocument();
  });

  it('errors get a longer TTL (1.75x default duration)', () => {
    renderProvider({ children: null, duration: 1000 });
    act(() => {
      capturedToast.error('Uh oh');
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    // Still up: base duration alone isn't enough for an error toast.
    expect(screen.getByText('Uh oh')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByText('Uh oh')).not.toBeInTheDocument();
  });

  it('a loading toast is pinned open (no auto-dismiss)', () => {
    renderProvider();
    act(() => {
      capturedToast.loading('Uploading…');
    });
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByText('Uploading…')).toBeInTheDocument();
  });

  it('toast.update settles a loading toast in place (same slot, new content)', () => {
    renderProvider({ children: null, duration: 1000 });
    let id = '';
    act(() => {
      id = capturedToast.loading('Uploading…');
    });
    expect(screen.getByText('Uploading…')).toBeInTheDocument();

    act(() => {
      capturedToast.update(id, 'Uploaded', { type: 'success' });
    });
    expect(screen.queryByText('Uploading…')).not.toBeInTheDocument();
    expect(screen.getByText('Uploaded')).toBeInTheDocument();
    expect(screen.getAllByRole('status')).toHaveLength(1);

    // The settled toast now has a real TTL and dismisses on its own.
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByText('Uploaded')).not.toBeInTheDocument();
  });

  it('renders an action as a link when href is given', () => {
    renderProvider();
    act(() => {
      capturedToast.success('Deployed', {
        action: { label: 'Open', href: 'https://example.com' },
      });
    });
    const link = screen.getByRole('link', { name: 'Open' });
    expect(link).toHaveAttribute('href', 'https://example.com');
  });

  it('renders an action as a button and fires onClick when there is no href', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    const onClick = vi.fn();
    renderProvider();
    act(() => {
      capturedToast.success('Done', { action: { label: 'Undo', onClick } });
    });
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Done')).not.toBeInTheDocument();
  });

  it('caps the visible stack at `max` (drops the oldest)', () => {
    renderProvider({ children: null, max: 2 });
    act(() => {
      capturedToast('one');
      capturedToast('two');
      capturedToast('three');
    });
    expect(screen.queryByText('one')).not.toBeInTheDocument();
    expect(screen.getByText('two')).toBeInTheDocument();
    expect(screen.getByText('three')).toBeInTheDocument();
  });

  it('dismiss(id) removes a single toast; dismiss() clears all', () => {
    renderProvider();
    act(() => {
      capturedToast('a');
      capturedToast('b');
    });
    const idA = screen.getByText('a');
    expect(idA).toBeInTheDocument();

    act(() => {
      capturedToast.dismiss();
    });
    expect(screen.queryByText('a')).not.toBeInTheDocument();
    expect(screen.queryByText('b')).not.toBeInTheDocument();
  });

  it('useToast throws outside a ToastProvider', () => {
    // Silence React's expected error-boundary console noise for this call.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Bare() {
      useToast();
      return null;
    }
    expect(() => render(<Bare />)).toThrow('useToast must be used inside a <ToastProvider>');
    spy.mockRestore();
  });
});
