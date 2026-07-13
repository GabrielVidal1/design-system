import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { useLocalStorage } from './use-local-storage';

afterEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('useLocalStorage', () => {
  it('starts from the initial value when nothing is stored', () => {
    const { result } = renderHook(() => useLocalStorage('greeting', 'hi'));
    expect(result.current[0]).toBe('hi');
  });

  it('persists writes to localStorage as JSON', () => {
    const { result } = renderHook(() => useLocalStorage('count', 0));
    act(() => result.current[1](5));
    expect(result.current[0]).toBe(5);
    expect(window.localStorage.getItem('count')).toBe('5');
  });

  it('parses an already-stored value on mount', () => {
    window.localStorage.setItem('user', JSON.stringify({ name: 'Ada' }));
    const { result } = renderHook(() => useLocalStorage('user', { name: '' }));
    expect(result.current[0]).toEqual({ name: 'Ada' });
  });

  it('supports a functional updater against the previous value', () => {
    const { result } = renderHook(() => useLocalStorage('count', 1));
    act(() => result.current[1]((prev) => prev + 41));
    expect(result.current[0]).toBe(42);
    expect(window.localStorage.getItem('count')).toBe('42');
  });

  it('survives bad JSON already in storage by falling back to initial', () => {
    window.localStorage.setItem('broken', '{not valid json');
    const { result } = renderHook(() => useLocalStorage('broken', 'fallback'));
    expect(result.current[0]).toBe('fallback');
  });

  it('re-reads when the key changes', () => {
    window.localStorage.setItem('key-b', JSON.stringify('b-value'));
    const { result, rerender } = renderHook(({ key }) => useLocalStorage(key, 'default'), {
      initialProps: { key: 'key-a' },
    });
    expect(result.current[0]).toBe('default');

    rerender({ key: 'key-b' });
    expect(result.current[0]).toBe('b-value');
  });

  it('uses sessionStorage instead when session=true', () => {
    const { result } = renderHook(() => useLocalStorage('session-key', 'x', { session: true }));
    act(() => result.current[1]('y'));
    expect(window.sessionStorage.getItem('session-key')).toBe('"y"');
    expect(window.localStorage.getItem('session-key')).toBeNull();
  });

  it('syncs another hook instance on the same key (same-tab broadcast)', () => {
    const a = renderHook(() => useLocalStorage('shared', 'init'));
    const b = renderHook(() => useLocalStorage('shared', 'init'));

    act(() => a.result.current[1]('updated'));

    expect(a.result.current[0]).toBe('updated');
    expect(b.result.current[0]).toBe('updated');
  });

  it('syncs on a native `storage` event (cross-tab)', () => {
    const { result } = renderHook(() => useLocalStorage('cross-tab', 'init'));
    act(() => {
      window.localStorage.setItem('cross-tab', JSON.stringify('from-other-tab'));
      window.dispatchEvent(new StorageEvent('storage', { key: 'cross-tab' }));
    });
    expect(result.current[0]).toBe('from-other-tab');
  });
});
