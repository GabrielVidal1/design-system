import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProgressiveText } from './progressive-text';

/**
 * These cover the wall-clock `timestamp` catch-up: the substring shown at mount
 * is a pure function of (now - timestamp), delay and speed — so a remount
 * resumes the reveal at the right character instead of starting empty. rAF
 * progression isn't asserted (jsdom has no real clock); the mount jump is.
 */
describe('ProgressiveText timestamp catch-up', () => {
  afterEach(() => vi.useRealTimers());

  const TEXT = 'hello world'; // 11 chars

  it('renders empty when the timestamp is now (nothing elapsed yet)', () => {
    const now = 1_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const { container } = render(<ProgressiveText text={TEXT} speed={10} timestamp={now} />);
    // speed 10 => 100ms/char, 0ms elapsed => 0 chars
    expect(container.textContent).toBe('');
  });

  it('jumps to the character due for the elapsed wall-clock time', () => {
    const now = 1_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    // started 350ms ago at 10 cps (100ms/char) => 3 chars due
    const { container } = render(
      <ProgressiveText text={TEXT} speed={10} timestamp={now - 350} />,
    );
    expect(container.textContent).toBe('hel');
  });

  it('shows the whole string once the full reveal is in the past', () => {
    const now = 1_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    // 11 chars * 100ms = 1100ms; started 5s ago => fully caught up
    const { container } = render(
      <ProgressiveText text={TEXT} speed={10} timestamp={now - 5000} />,
    );
    expect(container.textContent).toBe(TEXT);
  });

  it('subtracts the lead-in delay before counting characters', () => {
    const now = 1_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    // 500ms elapsed, but 300ms of it is the delay => 200ms of typing => 2 chars
    const { container } = render(
      <ProgressiveText text={TEXT} speed={10} delay={0.3} timestamp={now - 500} />,
    );
    expect(container.textContent).toBe('he');
  });

  it('accepts a Date as well as epoch ms', () => {
    const now = 1_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const { container } = render(
      <ProgressiveText text={TEXT} speed={10} timestamp={new Date(now - 350)} />,
    );
    expect(container.textContent).toBe('hel');
  });

  it('without a timestamp it starts empty regardless of the clock', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const { container } = render(<ProgressiveText text={TEXT} speed={10} />);
    expect(container.textContent).toBe('');
  });
});

/**
 * With `catchUp` the mount no longer snaps to the fully-due character: it seeds a
 * *window* behind (the instantly-shown part) and eases the rest in via rAF. Here
 * we assert the seed at mount — the ramp itself needs a real clock jsdom lacks.
 */
describe('ProgressiveText eased catch-up seed', () => {
  afterEach(() => vi.useRealTimers());
  const LONG = 'abcdefghijklmnopqrstuvwxyz0123456789'; // 36 chars

  it('seeds a window behind the due char instead of snapping to it', () => {
    const now = 1_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    // 3000ms elapsed @ 10cps (100ms/char) => 30 chars due.
    // catchUp 200ms => window 400ms => easedWindow=400ms=4 chars, seed=26 chars.
    const { container } = render(
      <ProgressiveText text={LONG} speed={10} timestamp={now - 3000} catchUp={200} />,
    );
    expect(container.textContent).toBe(LONG.slice(0, 26));
  });

  it('catchUp=0 still snaps to the fully-due char (unchanged default)', () => {
    const now = 1_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const { container } = render(
      <ProgressiveText text={LONG} speed={10} timestamp={now - 3000} catchUp={0} />,
    );
    expect(container.textContent).toBe(LONG.slice(0, 30));
  });

  it('a small backlog under the window seeds empty (eases the whole reveal)', () => {
    const now = 1_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    // 200ms elapsed => 2 chars due; window 400ms(4 chars) > backlog => seed 0.
    const { container } = render(
      <ProgressiveText text={LONG} speed={10} timestamp={now - 200} catchUp={200} />,
    );
    expect(container.textContent).toBe('');
  });
});
