import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './button';

describe('Button', () => {
  it('defaults to type="button" so it never submits a form by accident', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toHaveAttribute('type', 'button');
  });

  it('respects an explicit type="submit"', () => {
    render(<Button type="submit">Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'submit');
  });

  it('an icon-only button gets its accessible name from `tooltip`', () => {
    render(<Button size="icon" icon={<span data-testid="glyph" />} tooltip="Close" />);
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('an explicit aria-label wins over the tooltip-as-name fallback', () => {
    render(
      <Button size="icon" icon={<span />} tooltip="Close" aria-label="Dismiss dialog" />,
    );
    expect(screen.getByRole('button', { name: 'Dismiss dialog' })).toBeInTheDocument();
  });

  it('a text-tier button does not steal its name from the tooltip', () => {
    render(<Button tooltip="Extra hint">Save</Button>);
    // Accessible name stays "Save" — the tooltip is a description, not the name.
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('loading sets aria-busy and disables the button', () => {
    render(<Button loading>Save</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toBeDisabled();
  });

  it('loading prevents the onClick handler from firing', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );
    await user.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('disabled (non-loading) button has no aria-busy', () => {
    render(<Button disabled>Save</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).not.toHaveAttribute('aria-busy');
  });

  it('an unloading, enabled button fires onClick', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('keeps the label visible while loading unless loadingText is given', () => {
    render(<Button loading>Save</Button>);
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('swaps in loadingText for a text-tier button while loading', () => {
    render(
      <Button loading loadingText="Saving…">
        Save
      </Button>,
    );
    expect(screen.queryByText('Save')).not.toBeInTheDocument();
    expect(screen.getByText('Saving…')).toBeInTheDocument();
  });
});
