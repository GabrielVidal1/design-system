import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';

function now(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

export interface ProgressiveSlotValue {
  /**
   * True when this slot is the current head of the timeline — the moment its
   * children are meant to animate. Outside a {@link ProgressiveList} this is
   * always `true`, so a progressive element just animates on its own.
   */
  active: boolean;
  /**
   * A participating child announces that — once active — it will animate for
   * `durationMs`. The timeline waits (at least) that long before revealing the
   * next slot: this is how a list element's appearance is delayed by the inner
   * animation of the one before it. Calling it again raises the wait to the
   * longest reported duration (e.g. as streamed text grows). Returns a `done`
   * callback that advances the timeline immediately — call it the instant the
   * child actually finishes, if you want to hand off early.
   */
  report: (durationMs: number) => () => void;
  /** Advance the timeline for this slot right now (e.g. instant / static content). */
  finish: () => void;
}

const NOOP_SLOT: ProgressiveSlotValue = {
  active: true,
  report: () => () => {},
  finish: () => {},
};

const ProgressiveSlotContext = createContext<ProgressiveSlotValue>(NOOP_SLOT);

/**
 * Read the enclosing {@link ProgressiveList} timeline slot. Any component can
 * consume this to participate in the sequence:
 * - hold its animation until it's this slot's turn (`active`);
 * - tell the timeline how long it will animate (`report`) — so the *next* list
 *   element is delayed until this one's inner animation completes — or that it's
 *   done (`finish` / the `done` returned by `report`).
 *
 * Outside a ProgressiveList it returns an always-active no-op, so progressive
 * components keep working standalone.
 */
export function useProgressiveSlot(): ProgressiveSlotValue {
  return useContext(ProgressiveSlotContext);
}

export interface ProgressiveTimelineSlotProps {
  /** True while this slot is the head of the timeline — its turn to animate. */
  active: boolean;
  /** How long (ms) to hold the slot when no child reports an animation duration. */
  fallbackMs: number;
  /** Called once when the slot's turn ends, to advance the timeline. */
  onComplete: () => void;
  /** The subtree that reads this slot via {@link useProgressiveSlot}. */
  children: ReactNode;
}

/**
 * One slot on a {@link ProgressiveList}'s timeline. Provides the slot context to
 * its subtree and, while `active`, decides when to hand off to the next slot:
 * after the longest duration its children reported, or — if nothing reported —
 * after `fallbackMs`; whichever child calls its `done` early wins.
 */
export function ProgressiveTimelineSlot({
  active,
  fallbackMs,
  onComplete,
  children,
}: ProgressiveTimelineSlotProps) {
  const st = useRef({ activatedAt: 0, anyReport: false, maxDuration: 0, completed: false, timer: 0 });

  // A slot is mounted exactly when it becomes the head, so its first render is
  // the activation instant. Stamp it during render so a child's report() — which
  // runs in a child effect, before this component's own effects — sees a valid
  // clock to measure elapsed time against.
  if (active && st.current.activatedAt === 0) st.current.activatedAt = now();

  // Latest props read by the (stable) api closures without rebuilding them.
  const activeRef = useRef(active);
  activeRef.current = active;
  const fallbackRef = useRef(fallbackMs);
  fallbackRef.current = fallbackMs;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const api = useMemo(() => {
    const complete = () => {
      const s = st.current;
      if (s.completed) return;
      s.completed = true;
      if (s.timer) {
        clearTimeout(s.timer);
        s.timer = 0;
      }
      onCompleteRef.current();
    };
    const schedule = () => {
      const s = st.current;
      if (s.completed || !activeRef.current) return;
      if (s.timer) clearTimeout(s.timer);
      const target = s.anyReport ? s.maxDuration : fallbackRef.current;
      const elapsed = now() - s.activatedAt;
      s.timer = window.setTimeout(complete, Math.max(0, target - elapsed));
    };
    const report = (durationMs: number) => {
      const s = st.current;
      s.anyReport = true;
      s.maxDuration = Math.max(s.maxDuration, durationMs);
      schedule();
      return complete;
    };
    return { complete, schedule, report };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<ProgressiveSlotValue>(
    () => ({ active, report: api.report, finish: api.complete }),
    [active, api],
  );

  useEffect(() => {
    if (!active) return;
    const s = st.current;
    if (s.completed) return;
    if (s.activatedAt === 0) s.activatedAt = now();
    api.schedule(); // fallback / duration timer (reschedules over any earlier child report)
    return () => {
      if (s.timer) {
        clearTimeout(s.timer);
        s.timer = 0;
      }
    };
  }, [active, api]);

  return <ProgressiveSlotContext.Provider value={value}>{children}</ProgressiveSlotContext.Provider>;
}
