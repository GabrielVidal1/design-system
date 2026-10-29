import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDraft } from './use-draft';

const stored = (key: string) => {
  const raw = localStorage.getItem('rich-input:draft:' + key);
  return raw ? (JSON.parse(raw) as { text: string }).text : null;
};

describe('useDraft never drops the debounced keystrokes', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });
  afterEach(() => vi.useRealTimers());

  it('writes after the debounce', () => {
    const { result } = renderHook(() => useDraft('a'));
    act(() => result.current.setText('hello'));
    expect(stored('a')).toBeNull();
    act(() => vi.advanceTimersByTime(250));
    expect(stored('a')).toBe('hello');
  });

  it('writes the old key at once when the key changes mid-debounce', () => {
    const { result, rerender } = renderHook(({ k }) => useDraft(k), { initialProps: { k: 'a' } });
    act(() => result.current.setText('for a'));
    rerender({ k: 'b' });
    expect(stored('a')).toBe('for a');
    expect(result.current.text).toBe('');
    act(() => vi.advanceTimersByTime(1000));
    expect(stored('b')).toBeNull();
  });

  it('writes on unmount and on pagehide', () => {
    const one = renderHook(() => useDraft('u'));
    act(() => one.result.current.setText('typed, then gone'));
    one.unmount();
    expect(stored('u')).toBe('typed, then gone');

    const two = renderHook(() => useDraft('p'));
    act(() => two.result.current.setText('reloading'));
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(stored('p')).toBe('reloading');
  });

  it('a clear is never undone by the write it superseded', () => {
    const { result, unmount } = renderHook(() => useDraft('c'));
    act(() => result.current.setText('sent'));
    act(() => result.current.clear());
    unmount();
    expect(stored('c')).toBeNull();
  });
});
