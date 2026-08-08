import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Radio, RadioGroup } from './radio';

function Plans({ onValueChange, value }: { onValueChange?: (v: string) => void; value?: string }) {
  return (
    <RadioGroup value={value} onValueChange={onValueChange} defaultValue={value === undefined ? 'free' : undefined}>
      <Radio value="free" label="Free" />
      <Radio value="pro" label="Pro" description="$9/mo" />
      <Radio value="team" label="Team" />
    </RadioGroup>
  );
}

describe('RadioGroup / Radio', () => {
  it('selects on click and reports through onValueChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Plans onValueChange={onChange} />);

    const [free, pro] = screen.getAllByRole('radio');
    expect(free).toHaveAttribute('aria-checked', 'true');
    await user.click(pro);
    expect(onChange).toHaveBeenCalledWith('pro');
    expect(pro).toHaveAttribute('aria-checked', 'true');
    expect(free).toHaveAttribute('aria-checked', 'false');
  });

  it('stays put when controlled — parent owns the state', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Plans value="free" onValueChange={onChange} />);

    const [free, pro] = screen.getAllByRole('radio');
    await user.click(pro);
    expect(onChange).toHaveBeenCalledWith('pro');
    expect(free).toHaveAttribute('aria-checked', 'true');
  });

  it('moves and selects with ArrowDown, wrapping past the last option', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Plans onValueChange={onChange} />);

    screen.getByRole('radio', { name: 'Team' }).focus();
    await user.keyboard('{ArrowDown}');
    expect(onChange).toHaveBeenLastCalledWith('free');
    expect(screen.getByRole('radio', { name: 'Free' })).toHaveFocus();
  });

  it('exposes only the selected option in the tab order', () => {
    render(<Plans />);
    const [free, pro] = screen.getAllByRole('radio');
    expect(free).toHaveAttribute('tabIndex', '0');
    expect(pro).toHaveAttribute('tabIndex', '-1');
  });

  it('renders the description text', () => {
    render(<Plans />);
    expect(screen.getByText('$9/mo')).toBeInTheDocument();
  });
});
