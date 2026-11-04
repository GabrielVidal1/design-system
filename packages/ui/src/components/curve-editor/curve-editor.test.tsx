import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { EASINGS, curveFromEasing, evalCurve, type AnimationCurve } from './curve';
import { CurveEditor } from './curve-editor';

const two = curveFromEasing(EASINGS.easeOut);

function Harness({
  initial = two,
  onCommit,
  ...rest
}: { initial?: AnimationCurve; onCommit?: (c: AnimationCurve) => void } & Partial<
  React.ComponentProps<typeof CurveEditor>
>) {
  const [c, setC] = useState(initial);
  return (
    <>
      <CurveEditor value={c} onChange={setC} onCommit={onCommit} preview={false} {...rest} />
      <output data-testid="json">{JSON.stringify(c)}</output>
    </>
  );
}
const current = (): AnimationCurve => JSON.parse(screen.getByTestId('json').textContent!);

describe('CurveEditor', () => {
  it('draws a keyframe per point and two handles per segment', () => {
    render(<Harness />);
    expect(screen.getAllByRole('button', { name: /^Keyframe/ })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /handle/ })).toHaveLength(2);
  });

  it('adds a keyframe from the toolbar without changing the shape', () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add keyframe' }));
    const c = current();
    expect(c.points).toHaveLength(3);
    expect(c.points[1]!.x).toBe(0.5);
    expect(evalCurve(c, 0.25)).toBeCloseTo(evalCurve(two, 0.25), 2);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('nudges a focused keyframe with the arrows and removes it with Delete', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Add keyframe' }));
    const mid = screen.getByRole('button', { name: /^Keyframe 2:/ });
    fireEvent.focus(mid);
    const y0 = current().points[1]!.y;
    fireEvent.keyDown(mid, { key: 'ArrowUp' });
    expect(current().points[1]!.y).toBeCloseTo(y0 + 0.01, 3);
    fireEvent.keyDown(mid, { key: 'ArrowRight', shiftKey: true });
    expect(current().points[1]!.x).toBeCloseTo(0.55, 3);
    expect(screen.getByRole('button', { name: 'Remove keyframe' })).not.toBeDisabled();
    fireEvent.keyDown(mid, { key: 'Delete' });
    expect(current().points).toHaveLength(2);
  });

  it('keeps the ends locked in time and value', () => {
    render(<Harness />);
    const first = screen.getByRole('button', { name: /^Keyframe 1:/ });
    fireEvent.focus(first);
    fireEvent.keyDown(first, { key: 'ArrowUp' });
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(current().points[0]).toEqual({ x: 0, y: 0 });
    expect(screen.getByRole('button', { name: 'Remove keyframe' })).toBeDisabled();
  });

  it('lets a handle overshoot', () => {
    render(<Harness />);
    const h = screen.getAllByRole('button', { name: /handle/ })[1]!;
    fireEvent.focus(h);
    for (let i = 0; i < 6; i++) fireEvent.keyDown(h, { key: 'ArrowUp', shiftKey: true });
    expect(current().easings[0]![3]).toBeGreaterThan(1.2);
  });

  it('applies a preset, lights it, and resets to the default', () => {
    const linear = curveFromEasing(EASINGS.linear);
    render(<Harness presets={[{ label: 'Linear', curve: linear }]} defaultValue={two} />);
    const reset = screen.getByRole('button', { name: 'Reset curve' });
    expect(reset).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Linear/ }));
    expect(current()).toEqual(linear);
    expect(screen.getByRole('button', { name: /Linear/ })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(reset);
    expect(current()).toEqual(two);
  });

  it('renders the preview at the curve value', () => {
    render(<Harness preview renderPreview={(p) => <span data-testid="pv">{p.toFixed(2)}</span>} />);
    expect(screen.getByTestId('pv').textContent).toBe('0.00');
  });
});
