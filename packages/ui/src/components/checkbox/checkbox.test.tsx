import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Checkbox } from './checkbox';

const control = () => screen.getByRole('checkbox');

describe('Checkbox', () => {
  it('toggles uncontrolled state and reports through onCheckedChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Checkbox onCheckedChange={onChange} />);

    expect(control()).toHaveAttribute('aria-checked', 'false');
    await user.click(control());
    expect(control()).toHaveAttribute('aria-checked', 'true');
    expect(onChange).toHaveBeenCalledWith(true);
    await user.click(control());
    expect(control()).toHaveAttribute('aria-checked', 'false');
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it('respects defaultChecked', () => {
    render(<Checkbox defaultChecked />);
    expect(control()).toHaveAttribute('aria-checked', 'true');
  });

  it('stays put when controlled — parent owns the state', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Checkbox checked={false} onCheckedChange={onChange} />);

    await user.click(control());
    expect(onChange).toHaveBeenCalledWith(true);
    expect(control()).toHaveAttribute('aria-checked', 'false');
  });

  it('renders the mixed state and still toggles checked on click', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Checkbox indeterminate onCheckedChange={onChange} />);

    expect(control()).toHaveAttribute('aria-checked', 'mixed');
    await user.click(control());
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('renders a labelled row whose text toggles the control', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Checkbox label="Accept terms" description="Required to continue" onCheckedChange={onChange} />);

    expect(screen.getByText('Required to continue')).toBeInTheDocument();
    await user.click(screen.getByText('Accept terms'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('ignores clicks while disabled', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Checkbox disabled onCheckedChange={onChange} />);

    await user.click(control());
    expect(onChange).not.toHaveBeenCalled();
    expect(control()).toBeDisabled();
  });
});
