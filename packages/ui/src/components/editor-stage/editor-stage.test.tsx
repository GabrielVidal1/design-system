import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { EditorStage } from './editor-stage';
import type { EditorStageHandle, StagePointerEvent } from './editor-stage';

// jsdom has no layout: give every element a 400×300 box so `fit` has something
// to divide by, and stub the ResizeObserver it also lacks.
beforeAll(() => {
  Element.prototype.getBoundingClientRect = vi.fn(
    () => ({ left: 0, top: 0, width: 400, height: 300, right: 400, bottom: 300, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect,
  );
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  globalThis.ResizeObserver = class {
    constructor(private cb: ResizeObserverCallback) {}
    observe() {
      this.cb(
        [{ contentRect: { width: 400, height: 300 } } as ResizeObserverEntry],
        this as unknown as ResizeObserver,
      );
    }
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

const stage = (props: Partial<React.ComponentProps<typeof EditorStage>> = {}) => (
  <EditorStage contentWidth={100} contentHeight={100} {...props}>
    <div data-testid="content" />
  </EditorStage>
);

describe('EditorStage', () => {
  it('fits the content into the stage on mount', () => {
    const onViewportChange = vi.fn();
    render(stage({ onViewportChange }));
    // 300px tall box, 24px padding each side → 252/100
    const v = onViewportChange.mock.calls.at(-1)![0];
    expect(v.scale).toBeCloseTo(2.52);
    expect(v.x).toBeCloseTo((400 - 252) / 2);
  });

  it('reports pointer positions in content units', () => {
    const onStagePointerDown = vi.fn();
    render(
      stage({
        autoFit: false,
        viewport: { scale: 2, x: 10, y: 20 },
        onStagePointerDown,
      }),
    );
    fireEvent.pointerDown(screen.getByTestId('content').parentElement!.parentElement!, {
      clientX: 50,
      clientY: 60,
      pointerId: 1,
    });
    const e: StagePointerEvent = onStagePointerDown.mock.calls[0][0];
    expect(e.x).toBeCloseTo((50 - 10) / 2);
    expect(e.y).toBeCloseTo((60 - 20) / 2);
    expect(e.outside).toBe(false);
  });

  it('flags pointers landing outside the content box', () => {
    const onStagePointerDown = vi.fn();
    render(
      stage({ autoFit: false, viewport: { scale: 1, x: 0, y: 0 }, onStagePointerDown }),
    );
    fireEvent.pointerDown(screen.getByTestId('content').parentElement!.parentElement!, {
      clientX: 380,
      clientY: 10,
      pointerId: 1,
    });
    expect(onStagePointerDown.mock.calls[0][0].outside).toBe(true);
  });

  it('zooms about a point, keeping the content under it pinned', () => {
    const ref = createRef<EditorStageHandle>();
    const onViewportChange = vi.fn();
    render(stage({ ref, autoFit: false, onViewportChange }));
    ref.current!.setViewport({ scale: 1, x: 0, y: 0 });
    ref.current!.zoomBy(2); // about the middle of the 400×300 box
    const v = ref.current!.viewport();
    expect(v.scale).toBe(2);
    // the content point that was under (200, 150) must still be there
    expect((200 - v.x) / v.scale).toBeCloseTo(200);
    expect((150 - v.y) / v.scale).toBeCloseTo(150);
  });

  it('clamps the zoom to minScale/maxScale', () => {
    const ref = createRef<EditorStageHandle>();
    render(stage({ ref, autoFit: false, minScale: 0.5, maxScale: 4 }));
    ref.current!.setViewport({ scale: 1, x: 0, y: 0 });
    ref.current!.zoomBy(100);
    expect(ref.current!.viewport().scale).toBe(4);
    ref.current!.zoomBy(0.001);
    expect(ref.current!.viewport().scale).toBe(0.5);
  });

  it('centres a content point without changing the zoom', () => {
    const ref = createRef<EditorStageHandle>();
    render(stage({ ref, autoFit: false }));
    ref.current!.setViewport({ scale: 3, x: 0, y: 0 });
    ref.current!.centerOn(10, 10);
    const v = ref.current!.viewport();
    expect(v.scale).toBe(3);
    expect(10 * v.scale + v.x).toBeCloseTo(200);
    expect(10 * v.scale + v.y).toBeCloseTo(150);
  });
});
