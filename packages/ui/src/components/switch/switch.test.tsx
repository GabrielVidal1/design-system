import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Switch } from './switch';

const control = () => screen.getByRole('switch');

describe('Switch', () => {
  it('toggles uncontrolled state and reports through onCheckedChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switch onCheckedChange={onChange} />);

    expect(control()).toHaveAttribute('aria-checked', 'false');
    await user.click(control());
    expect(control()).toHaveAttribute('aria-checked', 'true');
    expect(onChange).toHaveBeenCalledWith(true);
    await user.click(control());
    expect(control()).toHaveAttribute('aria-checked', 'false');
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it('respects defaultChecked', () => {
    render(<Switch defaultChecked />);
    expect(control()).toHaveAttribute('aria-checked', 'true');
  });

  it('stays put when controlled — parent owns the state', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switch checked={false} onCheckedChange={onChange} />);

    await user.click(control());
    expect(onChange).toHaveBeenCalledWith(true);
    expect(control()).toHaveAttribute('aria-checked', 'false');
  });

  it('renders a labelled row whose text toggles the control', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switch label="Dark mode" description="Follows the OS by default" onCheckedChange={onChange} />);

    expect(screen.getByText('Follows the OS by default')).toBeInTheDocument();
    await user.click(screen.getByText('Dark mode'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('ignores clicks while disabled', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switch disabled onCheckedChange={onChange} />);

    await user.click(control());
    expect(onChange).not.toHaveBeenCalled();
    expect(control()).toBeDisabled();
  });
});
