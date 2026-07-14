import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Slider } from './slider';

const thumb = () => screen.getByRole('slider');

describe('Slider', () => {
  it('exposes value/min/max through ARIA and positions the fill', () => {
    render(<Slider defaultValue={30} max={120} />);
    expect(thumb()).toHaveAttribute('aria-valuenow', '30');
    expect(thumb()).toHaveAttribute('aria-valuemax', '120');
    expect(thumb().style.left).toBe('25%');
  });

  it('clamps and snaps the initial value to the step grid', () => {
    render(<Slider defaultValue={999} min={0} max={10} step={0.1} />);
    expect(thumb()).toHaveAttribute('aria-valuenow', '10');
  });

  it('steps with the keyboard and commits each press', () => {
    const onChange = vi.fn();
    const onCommit = vi.fn();
    render(<Slider defaultValue={50} step={5} onValueChange={onChange} onValueCommit={onCommit} />);

    fireEvent.keyDown(thumb(), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith(55);
    expect(onCommit).toHaveBeenCalledWith(55);
    fireEvent.keyDown(thumb(), { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith(50);
    fireEvent.keyDown(thumb(), { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith(100);
    fireEvent.keyDown(thumb(), { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith(0);
    fireEvent.keyDown(thumb(), { key: 'PageUp' });
    expect(onChange).toHaveBeenLastCalledWith(10);
  });

  it('does not move past the ends', () => {
    const onChange = vi.fn();
    render(<Slider defaultValue={100} onValueChange={onChange} />);
    fireEvent.keyDown(thumb(), { key: 'ArrowRight' });
    expect(onChange).not.toHaveBeenCalled();
    expect(thumb()).toHaveAttribute('aria-valuenow', '100');
  });

  it('stays put when controlled — parent owns the state', () => {
    const onChange = vi.fn();
    render(<Slider value={40} onValueChange={onChange} />);
    fireEvent.keyDown(thumb(), { key: 'ArrowUp' });
    expect(onChange).toHaveBeenCalledWith(41);
    expect(thumb()).toHaveAttribute('aria-valuenow', '40');
  });

  it('formats the shown value and aria-valuetext', () => {
    render(<Slider defaultValue={2} max={4} label="Zoom" showValue format={(v) => `${v}×`} />);
    expect(screen.getByText('Zoom')).toBeInTheDocument();
    expect(screen.getByText('2×')).toBeInTheDocument();
    expect(thumb()).toHaveAttribute('aria-valuetext', '2×');
  });

  it('ignores the keyboard while disabled', () => {
    const onChange = vi.fn();
    render(<Slider disabled defaultValue={50} onValueChange={onChange} />);
    fireEvent.keyDown(thumb(), { key: 'ArrowRight' });
    expect(onChange).not.toHaveBeenCalled();
    expect(thumb()).toHaveAttribute('tabindex', '-1');
  });
});
