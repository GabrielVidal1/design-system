import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ColorPicker } from './color-picker';

describe('ColorPicker', () => {
  it('renders inline with a hex field showing the value', () => {
    render(<ColorPicker inline value="#ff8800" onChange={() => {}} />);
    expect(screen.getByLabelText('Hex colour')).toHaveValue('ff8800');
  });

  it('commits a typed hex on Enter and reverts junk on blur', () => {
    const onChange = vi.fn();
    render(<ColorPicker inline value="#ff8800" onChange={onChange} />);
    const field = screen.getByLabelText('Hex colour');

    fireEvent.change(field, { target: { value: '00ff00' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    fireEvent.blur(field);
    expect(onChange).toHaveBeenCalledWith('#00ff00');

    // Junk reverts to the current colour on blur.
    fireEvent.change(field, { target: { value: 'ff' } });
    fireEvent.blur(field);
    expect(screen.getByLabelText('Hex colour')).toHaveValue('00ff00');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('expands 3-digit hex shorthand', () => {
    const onChange = vi.fn();
    render(<ColorPicker inline value="#000000" onChange={onChange} />);
    const field = screen.getByLabelText('Hex colour');
    fireEvent.change(field, { target: { value: 'f0a' } });
    fireEvent.blur(field);
    expect(onChange).toHaveBeenCalledWith('#ff00aa');
  });

  it('steps saturation/brightness with arrow keys on the SV area', () => {
    const onChange = vi.fn();
    render(<ColorPicker inline value="#808080" onChange={onChange} />);
    const area = screen.getByLabelText('Saturation and brightness');
    fireEvent.keyDown(area, { key: 'ArrowUp' });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('emits #rrggbbaa when alpha is on', () => {
    const onChange = vi.fn();
    render(<ColorPicker inline alpha value="#11223344" onChange={onChange} />);
    const slider = screen.getByLabelText('Opacity');
    fireEvent.keyDown(slider, { key: 'End' });
    expect(onChange).toHaveBeenCalledWith('#112233ff');
  });

  it('selects a swatch', () => {
    const onChange = vi.fn();
    render(
      <ColorPicker inline value="#000000" onChange={onChange} swatches={['#dc2626', '#16a34a']} />,
    );
    fireEvent.click(screen.getByRole('option', { name: '#16a34a' }));
    expect(onChange).toHaveBeenCalledWith('#16a34a');
  });

  it('keeps hue when the value passes through black', () => {
    const onChange = vi.fn();
    render(<ColorPicker inline value="#ff0000" onChange={onChange} />);
    const area = screen.getByLabelText('Saturation and brightness');
    // Drop brightness to 0 (black), then bring it back up — still red, not grey.
    for (let i = 0; i < 60; i++) fireEvent.keyDown(area, { key: 'ArrowDown', shiftKey: true });
    expect(onChange).toHaveBeenLastCalledWith('#000000');
    fireEvent.keyDown(area, { key: 'ArrowUp', shiftKey: true });
    const last = onChange.mock.calls.at(-1)![0] as string;
    expect(last).not.toBe('#1a1a1a'); // grey would mean hue was lost
    expect(parseInt(last.slice(1, 3), 16)).toBeGreaterThan(parseInt(last.slice(3, 5), 16));
  });
});
