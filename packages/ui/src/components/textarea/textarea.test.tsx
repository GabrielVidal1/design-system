import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Textarea } from './textarea';

describe('Textarea', () => {
  it('behaves like a native textarea — types and reports through onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Textarea placeholder="Notes…" onChange={onChange} />);

    const el = screen.getByPlaceholderText('Notes…');
    await user.type(el, 'hello');
    expect(el).toHaveValue('hello');
    expect(onChange).toHaveBeenCalled();
  });

  it('forwards the ref to the underlying textarea element', () => {
    const ref = createRef<HTMLTextAreaElement>();
    render(<Textarea ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
  });

  it('defaults rows to 3 and disables manual resize when autoGrow is on', () => {
    render(<Textarea placeholder="Grows" />);
    const el = screen.getByPlaceholderText('Grows');
    expect(el).toHaveAttribute('rows', '3');
    expect(el).toHaveStyle({ resize: 'none' });
  });

  it('leaves native resize behaviour alone when autoGrow is off', () => {
    render(<Textarea placeholder="Fixed" autoGrow={false} />);
    const el = screen.getByPlaceholderText('Fixed');
    expect(el.style.resize).not.toBe('none');
  });

  it('respects disabled', () => {
    render(<Textarea placeholder="Off" disabled />);
    expect(screen.getByPlaceholderText('Off')).toBeDisabled();
  });
});
