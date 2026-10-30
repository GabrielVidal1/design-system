import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProgressiveList } from './progressive-list';

/**
 * The lag limit (`getTimestamp` + `maxLag`): rows that happened longer ago than
 * `maxLag` land at once — rendered like history — whenever the timeline reaches
 * them, at mount or when appended later; rows inside the window still animate
 * one after the other.
 */
describe('ProgressiveList lag limit', () => {
  const NOW = 1_000_000_000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  type Row = { id: string; at: number };
  const rows = (...ages: number[]): Row[] => ages.map((age, i) => ({ id: `r${i}`, at: NOW - age }));

  function List({ items, maxLag }: { items: Row[]; maxLag?: number }) {
    return (
      <ProgressiveList
        items={items}
        speed={1} // 1 row/s, so a still-animating row is easy to tell apart
        getKey={(r) => r.id}
        getTimestamp={(r) => r.at}
        maxLag={maxLag}
      >
        {(r, _i, { isNew }) => <span data-row={r.id} data-new={String(isNew)} />}
      </ProgressiveList>
    );
  }

  // Let `ms` pass, then flush the 0 ms reveal the hand-off schedules.
  const step = (ms: number) => {
    act(() => vi.advanceTimersByTime(ms));
    act(() => vi.advanceTimersByTime(0));
  };
  const shown = (c: HTMLElement) => [...c.querySelectorAll('[data-row]')].map((e) => e.getAttribute('data-row'));
  const fresh = (c: HTMLElement) =>
    [...c.querySelectorAll('[data-new="true"]')].map((e) => e.getAttribute('data-row'));

  it('a backlog appended after mount lands at once, only the recent rows animate', () => {
    const { container, rerender } = render(<List items={rows(60_000)} />);
    expect(shown(container)).toEqual(['r0']); // the mount batch: history

    // A refetch brings 4 rows from a minute ago and 2 from the last second.
    rerender(<List items={rows(60_000, 50_000, 40_000, 30_000, 20_000, 800, 300)} />);
    expect(shown(container)).toEqual(['r0', 'r1', 'r2', 'r3', 'r4']); // landed, no timer
    expect(fresh(container)).toEqual([]); // …and rendered like history

    act(() => vi.advanceTimersByTime(0));
    expect(shown(container)).toContain('r5'); // the recent ones animate in turn
    expect(shown(container)).not.toContain('r6');
    expect(fresh(container)).toEqual(['r5']);
    step(1000);
    expect(shown(container)).toContain('r6');
  });

  it('rows queued behind a long animation land at once once it ends, if they got late', () => {
    const { container, rerender } = render(<List items={rows(60_000)} />);
    rerender(<List items={rows(60_000, 100)} />);
    act(() => vi.advanceTimersByTime(0));
    expect(fresh(container)).toEqual(['r1']); // animating (1 s fallback)

    // Two more rows arrive while r1 holds the timeline…
    rerender(<List items={rows(60_000, 100, 50, 10)} />);
    // …and by the time it hands off, 10 s have gone by: both are past the limit.
    act(() => {
      vi.setSystemTime(NOW + 10_000);
      vi.advanceTimersByTime(1000);
    });
    expect(shown(container)).toEqual(['r0', 'r1', 'r2', 'r3']);
    expect(fresh(container)).toEqual(['r1']);
  });

  it('rows within maxLag keep the classic one-by-one reveal', () => {
    const { container, rerender } = render(<List items={[]} />);
    rerender(<List items={rows(1000, 900, 800)} />);
    act(() => vi.advanceTimersByTime(0));
    expect(shown(container)).toEqual(['r0']);
    step(1000);
    expect(shown(container)).toEqual(['r0', 'r1']);
  });

  it('maxLag is configurable', () => {
    const { container, rerender } = render(<List items={[]} maxLag={500} />);
    rerender(<List items={rows(1000, 900, 100)} maxLag={500} />);
    expect(shown(container)).toEqual(['r0', 'r1']);
    expect(fresh(container)).toEqual([]);
  });

  it('a row without a timestamp animates as usual', () => {
    const { container, rerender } = render(
      <ProgressiveList items={[] as Row[]} speed={1} getTimestamp={() => null}>
        {(r) => <span data-row={r.id} />}
      </ProgressiveList>,
    );
    rerender(
      <ProgressiveList items={rows(60_000, 60_000)} speed={1} getTimestamp={() => null}>
        {(r) => <span data-row={r.id} />}
      </ProgressiveList>,
    );
    expect(shown(container)).toEqual([]);
    act(() => vi.advanceTimersByTime(0));
    expect(shown(container)).toEqual(['r0']);
  });
});
