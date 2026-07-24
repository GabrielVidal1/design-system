import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SplitView } from './split-view';

const handle = () => screen.getByRole('slider');

describe('SplitView', () => {
  it('starts at the default position and exposes it through ARIA', () => {
    render(<SplitView before={<span>before</span>} after={<span>after</span>} defaultValue={30} />);
    expect(handle()).toHaveAttribute('aria-valuenow', '30');
    expect(handle().style.left).toBe('30%');
  });

  it('defaults to 50 with no defaultValue', () => {
    render(<SplitView before={<span>before</span>} after={<span>after</span>} />);
    expect(handle()).toHaveAttribute('aria-valuenow', '50');
  });

  it('steps with the keyboard', () => {
    const onChange = vi.fn();
    render(
      <SplitView
        before={<span>before</span>}
        after={<span>after</span>}
        defaultValue={50}
        onValueChange={onChange}
      />,
    );
    fireEvent.keyDown(handle(), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith(52);
    fireEvent.keyDown(handle(), { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith(50);
    fireEvent.keyDown(handle(), { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith(100);
    fireEvent.keyDown(handle(), { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith(0);
  });

  it('clamps at the ends', () => {
    const onChange = vi.fn();
    render(
      <SplitView
        before={<span>before</span>}
        after={<span>after</span>}
        defaultValue={100}
        onValueChange={onChange}
      />,
    );
    fireEvent.keyDown(handle(), { key: 'ArrowRight' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('stays put when controlled — parent owns the state', () => {
    const onChange = vi.fn();
    render(
      <SplitView before={<span>before</span>} after={<span>after</span>} value={40} onValueChange={onChange} />,
    );
    fireEvent.keyDown(handle(), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith(42);
    expect(handle()).toHaveAttribute('aria-valuenow', '40');
  });

  it('renders no slider role when readonly', () => {
    render(<SplitView before={<span>before</span>} after={<span>after</span>} readonly />);
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  });

  it('ignores the keyboard while readonly', () => {
    const onChange = vi.fn();
    const { container } = render(
      <SplitView before={<span>before</span>} after={<span>after</span>} readonly onValueChange={onChange} />,
    );
    const el = container.querySelector('[aria-orientation]');
    expect(el).toBeNull();
  });

  it('shows captions when provided', () => {
    render(
      <SplitView
        before={<span>before</span>}
        after={<span>after</span>}
        captions={{ before: 'Original', after: 'Pixelated' }}
      />,
    );
    expect(screen.getByText('Original')).toBeInTheDocument();
    expect(screen.getByText('Pixelated')).toBeInTheDocument();
  });
});
