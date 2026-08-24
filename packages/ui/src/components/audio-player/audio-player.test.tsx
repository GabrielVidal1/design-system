import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AudioPlayer, extractPeaks } from './audio-player';

/* jsdom media elements don't implement playback — stub the surface we use,
 * including the `paused` flag the component's toggle reads. */
const pausedState = new WeakMap<HTMLMediaElement, boolean>();
beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
    pausedState.set(this, false);
    this.dispatchEvent(new Event('play'));
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (this: HTMLMediaElement) {
    pausedState.set(this, true);
    this.dispatchEvent(new Event('pause'));
  });
  vi.spyOn(HTMLMediaElement.prototype, 'paused', 'get').mockImplementation(function (this: HTMLMediaElement) {
    return pausedState.get(this) ?? true;
  });
});
afterEach(() => vi.restoreAllMocks());

const PEAKS = [0.2, 0.9, 0.5, 1, 0.3];

describe('AudioPlayer', () => {
  it('renders one waveform bar per peak and the duration', () => {
    const { container } = render(<AudioPlayer src="note.webm" peaks={PEAKS} duration={65} />);
    expect(screen.getByRole('slider').children).toHaveLength(PEAKS.length);
    expect(container.textContent).toContain('1:05');
  });

  it('toggles play/pause and reflects it in the button label', () => {
    render(<AudioPlayer src="note.webm" peaks={PEAKS} duration={10} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });

  it('pauses the other player when a second one starts (exclusive)', () => {
    render(
      <>
        <AudioPlayer src="a.webm" peaks={PEAKS} duration={10} data-testid="a" />
        <AudioPlayer src="b.webm" peaks={PEAKS} duration={10} data-testid="b" />
      </>,
    );
    const [playA, playB] = screen.getAllByRole('button', { name: 'Play' });
    fireEvent.click(playA);
    fireEvent.click(playB);
    // A got paused by B's start: both a play... and A shows Play again.
    const pauses = screen.getAllByRole('button', { name: 'Pause' });
    expect(pauses).toHaveLength(1);
  });

  it('seeks with the keyboard and exposes time through ARIA', () => {
    render(<AudioPlayer src="note.webm" peaks={PEAKS} duration={60} />);
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('aria-valuemax', '60');
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(slider).toHaveAttribute('aria-valuenow', '5');
    fireEvent.keyDown(slider, { key: 'End' });
    expect(slider).toHaveAttribute('aria-valuenow', '60');
    fireEvent.keyDown(slider, { key: 'Home' });
    expect(slider).toHaveAttribute('aria-valuenow', '0');
  });

  it('hides the speed pill when a single rate is allowed', () => {
    const { rerender } = render(<AudioPlayer src="n.webm" peaks={PEAKS} duration={5} />);
    expect(screen.getByRole('button', { name: /Playback speed/ })).toHaveTextContent('1×');
    rerender(<AudioPlayer src="n.webm" peaks={PEAKS} duration={5} rates={[1]} />);
    expect(screen.queryByRole('button', { name: /Playback speed/ })).toBeNull();
  });

  it('cycles playback rates on tap', () => {
    render(<AudioPlayer src="n.webm" peaks={PEAKS} duration={5} rates={[1, 1.5, 2]} />);
    const pill = screen.getByRole('button', { name: /Playback speed/ });
    fireEvent.click(pill);
    expect(pill).toHaveTextContent('1.5×');
    fireEvent.click(pill);
    expect(pill).toHaveTextContent('2×');
    fireEvent.click(pill);
    expect(pill).toHaveTextContent('1×');
  });
});

describe('extractPeaks', () => {
  it('resolves null where the Web Audio API is unavailable (jsdom)', async () => {
    await expect(extractPeaks(new Blob(['x']))).resolves.toBeNull();
  });
});
