import { describe, expect, it, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { createRef } from 'react';

import { PhoneKeyboard, type PhoneKeyboardHandle } from './phone-keyboard';
import { PhoneKeyboardProvider } from './text-buffer';
import { PhoneTextField } from './phone-text-field';
import { AZERTY, QWERTY, findKey, rowUnits } from './layouts';

/** Advance fake timers inside act() so the awaited animation loops make progress. */
async function tick(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function setup(props: Partial<React.ComponentProps<typeof PhoneKeyboard>> = {}) {
  const ref = createRef<PhoneKeyboardHandle>();
  const onValueChange = vi.fn();
  render(<PhoneKeyboard ref={ref} onValueChange={onValueChange} {...props} />);
  return { ref, onValueChange };
}

describe('layouts', () => {
  it('lays every row out on the same 10-column grid', () => {
    for (const page of [AZERTY.letters, AZERTY.symbols, AZERTY.more, QWERTY.letters]) {
      for (const row of page) expect(Math.abs(rowUnits(row) - 10)).toBeLessThanOrEqual(0.1);
    }
  });

  it('locates a character, and whether shift is needed for it', () => {
    expect(findKey(AZERTY, 'a')).toMatchObject({ page: 'letters', row: 0, index: 0, shift: false });
    expect(findKey(AZERTY, 'A')).toMatchObject({ page: 'letters', row: 0, index: 0, shift: true });
    expect(findKey(AZERTY, '€')).toMatchObject({ page: 'symbols' });
    expect(findKey(AZERTY, '\n')).toBeNull();
  });
});

describe('PhoneKeyboard taps', () => {
  it('inserts the tapped character, lower-case until shift', () => {
    const { ref, onValueChange } = setup({ autoCapitalize: false });
    act(() => ref.current!.press('a'));
    act(() => ref.current!.press('z'));
    expect(ref.current!.value).toBe('az');
    expect(onValueChange).toHaveBeenLastCalledWith('az', expect.objectContaining({ op: 'insert', chars: 'z' }));
  });

  it('shift is a one-shot: one capital, then back to lower-case', () => {
    const { ref } = setup({ autoCapitalize: false });
    act(() => ref.current!.press('shift'));
    act(() => ref.current!.press('a'));
    act(() => ref.current!.press('b'));
    expect(ref.current!.value).toBe('Ab');
  });

  it('auto-capitalises the first letter of a sentence, like Gboard', () => {
    const { ref } = setup();
    act(() => ref.current!.press('h'));
    act(() => ref.current!.press('i'));
    act(() => ref.current!.press('.'));
    act(() => ref.current!.press(' '));
    act(() => ref.current!.press('o'));
    expect(ref.current!.value).toBe('Hi. O');
  });

  it('deletes one character per backspace tap', () => {
    const { ref } = setup({ defaultValue: 'abc', autoCapitalize: false });
    act(() => ref.current!.press('backspace'));
    expect(ref.current!.value).toBe('ab');
  });

  it('renders shift as pressed while it is engaged', () => {
    const { ref } = setup({ autoCapitalize: false });
    expect(screen.getByLabelText('Shift')).toHaveAttribute('aria-pressed', 'false');
    act(() => ref.current!.press('shift'));
    expect(screen.getByLabelText('Shift')).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('PhoneKeyboardHandle animations', () => {
  it('types character by character', async () => {
    vi.useFakeTimers();
    try {
      const { ref } = setup({ autoCapitalize: false });
      let done = false;
      act(() => {
        void ref.current!.type('hey', { cps: 10, jitter: 0, punctuationPause: 0 }).then(() => (done = true));
      });
      expect(ref.current!.value).toBe('h');
      expect(ref.current!.busy).toBe(true);
      await tick(100);
      expect(ref.current!.value).toBe('he');
      await tick(100);
      expect(ref.current!.value).toBe('hey');
      await tick(200);
      expect(done).toBe(true);
      expect(ref.current!.busy).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('flips to the symbols page for a character that is not on the letter page', async () => {
    vi.useFakeTimers();
    try {
      const { ref } = setup({ autoCapitalize: false });
      act(() => {
        void ref.current!.type('a€', { cps: 20, jitter: 0, punctuationPause: 0 });
      });
      await tick(400);
      expect(ref.current!.value).toBe('a€');
      // and it comes back to the letters afterwards
      await tick(400);
      expect(screen.getByLabelText('Shift')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('holds the delete key: one immediate delete, then an accelerating repeat', async () => {
    vi.useFakeTimers();
    try {
      const { ref } = setup({ defaultValue: 'abcdef', autoCapitalize: false });
      act(() => {
        void ref.current!.backspace(undefined, { holdDelay: 300, from: 100, to: 100, ramp: 0, wordsAfter: Infinity });
      });
      expect(ref.current!.value).toBe('abcde'); // the press itself deletes one
      await tick(299);
      expect(ref.current!.value).toBe('abcde'); // still holding
      await tick(2);
      expect(ref.current!.value).toBe('abcd');
      await tick(100);
      expect(ref.current!.value).toBe('abc');
      await tick(1000);
      expect(ref.current!.value).toBe('');
      expect(ref.current!.busy).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('eats whole words once the hold gets going', async () => {
    vi.useFakeTimers();
    try {
      const { ref } = setup({ defaultValue: 'one two three', autoCapitalize: false });
      act(() => {
        void ref.current!.backspace(undefined, { holdDelay: 0, from: 10, to: 10, ramp: 0, wordsAfter: 1 });
      });
      expect(ref.current!.value).toBe('one two thre'); // the press
      await tick(5); // first repeat, still character by character
      expect(ref.current!.value).toBe('one two thr');
      await tick(10); // and from here on, whole words
      expect(ref.current!.value).toBe('one two ');
      await tick(10);
      expect(ref.current!.value).toBe('one ');
      await tick(10);
      expect(ref.current!.value).toBe('');
    } finally {
      vi.useRealTimers();
    }
  });

  it('replace() deletes everything, then types the new text', async () => {
    vi.useFakeTimers();
    try {
      const { ref } = setup({ defaultValue: 'old', autoCapitalize: false });
      act(() => {
        void ref.current!.replace('new', {
          delete: { holdDelay: 10, from: 10, to: 10, ramp: 0 },
          gap: 20,
          type: { cps: 100, jitter: 0, punctuationPause: 0 },
        });
      });
      await tick(25);
      expect(ref.current!.value).toBe(''); // held down to empty
      await tick(200);
      expect(ref.current!.value).toBe('new');
    } finally {
      vi.useRealTimers();
    }
  });

  it('stop() cancels a running animation, and a tap supersedes it', async () => {
    vi.useFakeTimers();
    try {
      const { ref } = setup({ autoCapitalize: false });
      act(() => {
        void ref.current!.type('abcdef', { cps: 10, jitter: 0, punctuationPause: 0 });
      });
      await tick(120);
      act(() => ref.current!.stop());
      const frozen = ref.current!.value;
      await tick(500);
      expect(ref.current!.value).toBe(frozen);
      expect(ref.current!.busy).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('setValue() jumps with no animation', () => {
    const { ref } = setup();
    act(() => ref.current!.setValue('jumped'));
    expect(ref.current!.value).toBe('jumped');
  });
});

describe('PhoneTextField', () => {
  it('shows the placeholder, then what the shared keyboard types', () => {
    const ref = createRef<PhoneKeyboardHandle>();
    const { container } = render(
      <PhoneKeyboardProvider>
        <PhoneTextField className="field" placeholder="Say something" />
        <PhoneKeyboard ref={ref} autoCapitalize={false} />
      </PhoneKeyboardProvider>,
    );
    const field = () => container.querySelector('.field')!.textContent;
    expect(screen.getByText('Say something')).toBeInTheDocument();
    act(() => ref.current!.press('h'));
    act(() => ref.current!.press('i'));
    expect(field()).toBe('hi');
    expect(ref.current!.value).toBe('hi');
  });

  it('marks up the last typed characters so they can animate in', () => {
    const { container, rerender } = render(<PhoneTextField value="he" />);
    expect(container.querySelector('.ds-phone-caret')).not.toBeNull();
    rerender(<PhoneTextField value="hey" />);
    expect(container.querySelector('.ds-phone-typed')!.textContent).toBe('y');
  });

  it('keeps a deleted character around for one animation, at the caret', () => {
    const { container, rerender } = render(<PhoneTextField value="hey" />);
    rerender(<PhoneTextField value="he" />);
    expect(container.querySelector('.ds-phone-eaten')!.textContent).toBe('y');
  });
});
