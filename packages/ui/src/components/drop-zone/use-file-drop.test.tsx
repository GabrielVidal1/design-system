import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useFileDrop, type UseFileDropOptions } from './use-file-drop';

function Harness(props: UseFileDropOptions) {
  useFileDrop(props);
  return <input data-testid="field" type="text" />;
}

// jsdom can't construct a DataTransfer, so fake the clipboard payload on a
// plain event — the hook only reads `clipboardData.files`.
function pasteEvent(files: File[], target: EventTarget = document) {
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: { files } });
  target.dispatchEvent(event);
  return event;
}

const png = () => new File(['x'], 'shot.png', { type: 'image/png' });

describe('useFileDrop paste', () => {
  it('takes clipboard files pasted on the page', () => {
    const onFiles = vi.fn();
    render(<Harness onFiles={onFiles} paste />);

    const e = pasteEvent([png()]);

    expect(onFiles).toHaveBeenCalledWith([expect.objectContaining({ name: 'shot.png' })]);
    expect(e.defaultPrevented).toBe(true);
  });

  it('does nothing without the paste option', () => {
    const onFiles = vi.fn();
    render(<Harness onFiles={onFiles} />);

    pasteEvent([png()]);

    expect(onFiles).not.toHaveBeenCalled();
  });

  it('leaves pastes aimed at an editable element alone', () => {
    const onFiles = vi.fn();
    const { getByTestId } = render(<Harness onFiles={onFiles} paste />);

    const e = pasteEvent([png()], getByTestId('field'));

    expect(onFiles).not.toHaveBeenCalled();
    expect(e.defaultPrevented).toBe(false);
  });

  it('runs pasted files through the accept filter', () => {
    const onFiles = vi.fn();
    const onReject = vi.fn();
    render(<Harness onFiles={onFiles} paste accept="image/*" onReject={onReject} />);

    pasteEvent([new File(['x'], 'notes.txt', { type: 'text/plain' })]);

    expect(onFiles).not.toHaveBeenCalled();
    expect(onReject).toHaveBeenCalledWith([
      expect.objectContaining({ reason: 'type' }),
    ]);
  });

  it('ignores pastes while disabled', () => {
    const onFiles = vi.fn();
    render(<Harness onFiles={onFiles} paste disabled />);

    pasteEvent([png()]);

    expect(onFiles).not.toHaveBeenCalled();
  });
});
