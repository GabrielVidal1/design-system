import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';

import { TagFilter, type TagFilterProps } from './tag-filter';

const ITEMS = [
  { id: 'inbox', label: 'Inbox', count: 3 },
  { id: 'alerts', label: 'Alerts' },
  { id: 'spam', label: 'Spam', disabled: true },
];

function Controlled(props: Partial<TagFilterProps>) {
  const [value, setValue] = useState<string[]>(props.value ?? []);
  return <TagFilter items={ITEMS} {...props} value={value} onChange={setValue} />;
}

const chip = (name: string | RegExp) => screen.getByRole('button', { name });

describe('TagFilter', () => {
  it('renders the All chip as selected when nothing is filtered', () => {
    render(<Controlled />);
    expect(chip('All')).toHaveAttribute('aria-pressed', 'true');
    expect(chip(/Inbox/)).toHaveAttribute('aria-pressed', 'false');
  });

  it('single-select: a chip replaces the selection, clicking it again clears', async () => {
    const onChange = vi.fn();
    render(<TagFilter items={ITEMS} value={['inbox']} onChange={onChange} />);

    await userEvent.click(chip('Alerts'));
    expect(onChange).toHaveBeenCalledWith(['alerts']);

    await userEvent.click(chip(/Inbox/));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('multiple: chips accumulate and toggle off individually', async () => {
    const onChange = vi.fn();
    render(<TagFilter items={ITEMS} value={['inbox']} onChange={onChange} multiple />);

    await userEvent.click(chip('Alerts'));
    expect(onChange).toHaveBeenCalledWith(['inbox', 'alerts']);

    await userEvent.click(chip(/Inbox/));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('the All chip clears the selection', async () => {
    const onChange = vi.fn();
    render(<TagFilter items={ITEMS} value={['inbox', 'alerts']} onChange={onChange} multiple />);
    await userEvent.click(chip('All'));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('honours allLabel: relabel or hide', () => {
    const { rerender } = render(<TagFilter items={ITEMS} value={[]} onChange={() => {}} allLabel="All mail" />);
    expect(chip('All mail')).toBeInTheDocument();

    rerender(<TagFilter items={ITEMS} value={[]} onChange={() => {}} allLabel={false} />);
    expect(screen.queryByRole('button', { name: /All/ })).not.toBeInTheDocument();
  });

  it('shows counts and disables chips', () => {
    render(<Controlled />);
    expect(chip(/Inbox/)).toHaveTextContent('3');
    expect(chip('Spam')).toBeDisabled();
  });
});
