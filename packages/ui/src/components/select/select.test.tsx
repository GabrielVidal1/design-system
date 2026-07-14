import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Select } from './select';

const OPTIONS = [
  { value: 'qwen', label: 'Qwen 3' },
  { value: 'gemma', label: 'Gemma 3' },
  { value: 'llama', label: 'Llama 4', disabled: true },
  { value: 'gpt', label: 'GPT-5' },
];

const trigger = () => screen.getByRole('button');

describe('Select', () => {
  it('shows the placeholder, then the picked option', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Select options={OPTIONS} placeholder="Pick a model" onValueChange={onChange} />);

    expect(trigger()).toHaveTextContent('Pick a model');
    await user.click(trigger());
    await user.click(screen.getByRole('option', { name: 'Gemma 3' }));
    expect(onChange).toHaveBeenCalledWith('gemma');
    expect(trigger()).toHaveTextContent('Gemma 3');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('drives the whole flow from the keyboard, skipping disabled options', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Select options={OPTIONS} defaultValue="qwen" onValueChange={onChange} />);

    trigger().focus();
    await user.keyboard('{ArrowDown}'); // open, active on the selected option
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await user.keyboard('{ArrowDown}'); // → Gemma 3
    await user.keyboard('{ArrowDown}'); // skips disabled Llama 4 → GPT-5
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('gpt');
  });

  it('closes on Escape without changing the value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Select options={OPTIONS} onValueChange={onChange} />);

    await user.click(trigger());
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('closes when a click lands outside', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <Select options={OPTIONS} />
        <p>elsewhere</p>
      </div>,
    );
    await user.click(trigger());
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await user.click(screen.getByText('elsewhere'));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('filters options when searchable', async () => {
    const user = userEvent.setup();
    render(<Select options={OPTIONS} searchable />);

    await user.click(trigger());
    await user.keyboard('gem');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('option', { name: 'Gemma 3' })).toBeInTheDocument();
    await user.keyboard('zzz');
    expect(screen.getByText('No matches')).toBeInTheDocument();
  });

  it('marks the selected option and stays put when controlled', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Select options={OPTIONS} value="qwen" onValueChange={onChange} />);

    await user.click(trigger());
    expect(screen.getByRole('option', { name: /Qwen 3/ })).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('option', { name: 'GPT-5' }));
    expect(onChange).toHaveBeenCalledWith('gpt');
    expect(trigger()).toHaveTextContent('Qwen 3');
  });

  it('does not open while disabled', async () => {
    const user = userEvent.setup();
    render(<Select options={OPTIONS} disabled />);
    await user.click(trigger());
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
