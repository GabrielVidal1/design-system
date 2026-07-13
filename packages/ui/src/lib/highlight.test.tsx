import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { highlightAll, highlightSnippet } from './highlight';

describe('highlightAll', () => {
  it('returns the plain string when there are no indices', () => {
    expect(highlightAll('hello world', [])).toBe('hello world');
  });

  it('wraps a single matched range in <mark>', () => {
    const { container } = render(<>{highlightAll('hello world', [[0, 4]])}</>);
    const mark = container.querySelector('mark');
    expect(mark).not.toBeNull();
    expect(mark).toHaveTextContent('hello');
    expect(container).toHaveTextContent('hello world');
  });

  it('merges overlapping/adjacent ranges into one <mark>', () => {
    const { container } = render(
      <>
        {highlightAll('abcdef', [
          [0, 1],
          [2, 3],
        ])}
      </>,
    );
    // [0,1] -> [0,2), [2,3] -> [2,4): adjacent, so they merge into one mark "abcd".
    const marks = container.querySelectorAll('mark');
    expect(marks).toHaveLength(1);
    expect(marks[0]).toHaveTextContent('abcd');
  });

  it('drops ranges shorter than the minimum length (single fuzzy-char hits)', () => {
    // A single-character range ([2,2] -> length 1) is below the highlightAll
    // min length of 2 and should not produce a <mark> at all.
    const { container } = render(<>{highlightAll('abcdef', [[2, 2]])}</>);
    expect(container.querySelectorAll('mark')).toHaveLength(0);
    expect(container).toHaveTextContent('abcdef');
  });

  it('preserves the unmatched text around the match', () => {
    const { container } = render(<>{highlightAll('foo bar baz', [[4, 6]])}</>);
    expect(container).toHaveTextContent('foo bar baz');
    expect(container.querySelector('mark')).toHaveTextContent('bar');
  });
});

describe('highlightSnippet', () => {
  it('marks the match without windowing when the text is shorter than the window', () => {
    const { container } = render(<>{highlightSnippet('hello world', [[6, 10]])}</>);
    expect(container.querySelector('mark')).toHaveTextContent('world');
    expect(container.textContent).not.toContain('…');
  });

  it('adds a leading ellipsis when the snippet starts after the text start', () => {
    const text = 'x'.repeat(100) + 'NEEDLE' + 'y'.repeat(400);
    const start = 100;
    // Default window (260) comfortably covers [start-60, start+window).
    const { container } = render(<>{highlightSnippet(text, [[start, start + 5]])}</>);
    expect(container.textContent?.startsWith('… ')).toBe(true);
    expect(container.querySelector('mark')).toHaveTextContent('NEEDLE');
  });

  it('adds a trailing ellipsis when the snippet is cut off before the text end', () => {
    const text = 'NEEDLE' + 'y'.repeat(400);
    const { container } = render(<>{highlightSnippet(text, [[0, 5]], 40)}</>);
    expect(container.textContent?.endsWith(' …')).toBe(true);
  });
});
