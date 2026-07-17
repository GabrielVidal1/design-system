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
