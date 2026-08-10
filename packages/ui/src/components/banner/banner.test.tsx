import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Banner } from './banner';

describe('Banner', () => {
  it('renders the message as a status region by default', () => {
    render(<Banner>Deploy finished</Banner>);
    const region = screen.getByRole('status');
    expect(region).toHaveTextContent('Deploy finished');
  });

  it('uses role="alert" for the error type', () => {
    render(<Banner type="error">Something broke</Banner>);
    expect(screen.getByRole('alert')).toHaveTextContent('Something broke');
  });

  it('renders an optional title above the message', () => {
    render(<Banner title="Heads up">Body copy</Banner>);
    expect(screen.getByText('Heads up')).toBeInTheDocument();
    expect(screen.getByText('Body copy')).toBeInTheDocument();
  });

  it('hides the icon when icon={false}', () => {
    const { container } = render(<Banner icon={false}>No icon</Banner>);
    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });

  it('is not dismissible without onDismiss', () => {
    render(<Banner>Static</Banner>);
    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
  });

  it('calls onDismiss when the dismiss button is clicked', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<Banner onDismiss={onDismiss}>Dismissible</Banner>);

    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders an inline action as a link when href is set', () => {
    render(<Banner action={{ label: 'Learn more', href: 'https://example.com' }}>Info</Banner>);
    const link = screen.getByRole('link', { name: 'Learn more' });
    expect(link).toHaveAttribute('href', 'https://example.com');
  });

  it('renders an inline action as a button and fires onClick', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Banner action={{ label: 'Retry', onClick }}>Failed</Banner>);

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
