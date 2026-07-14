import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { buildStrip, CharRoll } from './char-roll';

describe('buildStrip', () => {
  it('an unchanged char with no turns is a single resting cell', () => {
    expect(buildStrip('7', '7', 0)).toEqual(['7']);
    expect(buildStrip('x', 'x', 3)).toEqual(['x']);
  });

  it('digit → digit rolls through every intermediate digit, new char on top', () => {
    expect(buildStrip('3', '6', 0)).toEqual(['6', '5', '4', '3']);
  });

  it('wraps 9 → 0 like a counter wheel', () => {
    expect(buildStrip('8', '1', 0)).toEqual(['1', '0', '9', '8']);
  });

  it('turns add full revolutions of ten', () => {
    const strip = buildStrip('3', '6', 2);
    expect(strip).toHaveLength(3 + 2 * 10 + 1);
    expect(strip[0]).toBe('6');
    expect(strip[strip.length - 1]).toBe('3');
  });

  it('an unchanged digit still spins when given turns', () => {
    expect(buildStrip('4', '4', 1)).toHaveLength(11);
  });

  it('non-digit characters flip in a single step', () => {
    expect(buildStrip('a', 'z', 5)).toEqual(['z', 'a']);
    expect(buildStrip('$', '€', 0)).toEqual(['€', '$']);
  });

  it('a new cell rolls in from blank', () => {
    expect(buildStrip('', '7', 0)).toEqual(['7', '']);
  });
});

describe('CharRoll', () => {
  it('renders the value and exposes it as the accessible label', () => {
    render(<CharRoll value="$1.23" data-testid="roll" />);
    const el = screen.getByTestId('roll');
    expect(el).toHaveAttribute('aria-label', '$1.23');
    // Each cell renders the char twice (hidden sizer + strip) — check per char.
    for (const c of '$1.23') expect(el.textContent).toContain(c);
  });

  it('accepts a number', () => {
    render(<CharRoll value={1234} data-testid="roll" />);
    expect(screen.getByTestId('roll')).toHaveAttribute('aria-label', '1234');
  });

  it('shows the new value after a change', () => {
    const { rerender } = render(<CharRoll value="99" data-testid="roll" />);
    rerender(<CharRoll value="100" data-testid="roll" />);
    const el = screen.getByTestId('roll');
    expect(el).toHaveAttribute('aria-label', '100');
    // The resting (top) char of every cell is the new value.
    expect(el.textContent).toContain('1');
  });

  it('renders one sizer + strip cell per character', () => {
    render(<CharRoll value="abc" data-testid="roll" />);
    const el = screen.getByTestId('roll');
    expect(el.querySelectorAll(':scope > span')).toHaveLength(3);
  });
});
