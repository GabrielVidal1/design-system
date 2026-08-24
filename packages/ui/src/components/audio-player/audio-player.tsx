import * as React from 'react';
import { Pause, Play } from 'lucide-react';

import { cn } from '../../lib/utils';
import type { Tone } from '../status-badge';

/*
 * Tones are written out in full — Tailwind scans source text, so a template
 * literal like `bg-${tone}-500` would compile to nothing.
 */
const BAR_TONES: Record<Tone, string> = {
  neutral: 'bg-foreground/80',
  sky: 'bg-sky-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  violet: 'bg-violet-500',
};

/**
 * Reduce an audio source to `bars` normalized peak values (0..1) via the Web
 * Audio API — the waveform an {@link AudioPlayer} draws. Call it yourself to
 * precompute peaks once (e.g. right after recording a voice note, storing them
 * with the file) and pass them as the `peaks` prop so playback never has to
 * re-download and decode the audio. Resolves to `null` where decoding isn't
 * possible (no `AudioContext`, opaque response, unsupported codec).
 */
export async function extractPeaks(
  source: string | Blob | ArrayBuffer,
  bars = 40,
): Promise<number[] | null> {
  const AC: typeof AudioContext | undefined =
    typeof window !== 'undefined'
      ? (window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
      : undefined;
  if (!AC) return null;

  try {
    let buf: ArrayBuffer;
    if (typeof source === 'string') buf = await (await fetch(source)).arrayBuffer();
    else if (source instanceof Blob) buf = await source.arrayBuffer();
    else buf = source;

    const ctx = new AC();
    try {
      const audio = await ctx.decodeAudioData(buf);
      const data = audio.getChannelData(0);
      const window_ = Math.max(1, Math.floor(data.length / bars));
      const peaks: number[] = [];
      for (let i = 0; i < bars; i++) {
        let max = 0;
        const start = i * window_;
        const end = Math.min(start + window_, data.length);
        // Sample the window sparsely — full scans of long files buy no visible precision.
        const stride = Math.max(1, Math.floor((end - start) / 200));
        for (let j = start; j < end; j += stride) {
          const v = Math.abs(data[j]);
          if (v > max) max = v;
        }
        peaks.push(max);
      }
      const top = Math.max(...peaks, 0.01);
      return peaks.map((p) => p / top);
    } finally {
      void ctx.close();
    }
  } catch {
    return null;
  }
}

/** Deterministic placeholder bars for when the waveform can't be decoded. */
function placeholderPeaks(bars: number): number[] {
  return Array.from({ length: bars }, (_, i) => 0.35 + 0.3 * Math.abs(Math.sin(i * 1.7 + 1)));
}

function fmtTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/* Only one player sounds at a time (opt out with `exclusive={false}`). */
let pauseCurrent: (() => void) | null = null;

export interface AudioPlayerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onEnded'> {
  /** Audio URL — remote file or `URL.createObjectURL(blob)`. */
  src: string;
  /**
   * Precomputed waveform peaks (0..1, see {@link extractPeaks}). When omitted
   * the player decodes `src` itself; if that fails it falls back to a neutral
   * placeholder pattern.
   */
  peaks?: number[];
  /** Waveform bar count. @default 40 */
  bars?: number;
  /** Colour of the played part of the waveform and the play button. @default 'sky' */
  tone?: Tone;
  /**
   * Playback-rate cycle for the speed pill (tap to advance). One entry (or
   * fewer) hides the pill. @default [1, 1.5, 2]
   */
  rates?: number[];
  /**
   * Duration hint in seconds — used when the file's metadata doesn't carry one
   * (`MediaRecorder` WebM blobs report `Infinity` until fully seeked).
   */
  duration?: number;
  autoPlay?: boolean;
  /** Pause any other AudioPlayer when this one starts. @default true */
  exclusive?: boolean;
  onEnded?: () => void;
}

/**
 * A compact voice-note-style audio player — a play/pause disc, a seekable
 * peak waveform that fills as it plays, elapsed/total time and a
 * playback-speed pill, in one touch-first row. Feed it any audio URL (or an
 * object URL of a just-recorded blob); pass `peaks` from {@link extractPeaks}
 * to skip the decode, and a `duration` hint for `MediaRecorder` blobs whose
 * metadata lacks one. Only one player sounds at a time unless
 * `exclusive={false}`. Scrub by pointer anywhere on the waveform, or with
 * arrow/Home/End keys on the slider.
 *
 * @summary Compact audio/voice-note player: play disc, seekable waveform,
 * time, speed pill.
 */
export function AudioPlayer({
  src,
  peaks: peaksProp,
  bars = 40,
  tone = 'sky',
  rates = [1, 1.5, 2],
  duration: durationHint,
  autoPlay = false,
  exclusive = true,
  onEnded,
  className,
  ...props
}: AudioPlayerProps) {
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const trackRef = React.useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = React.useState(false);
  const [current, setCurrent] = React.useState(0);
  const [metaDuration, setMetaDuration] = React.useState<number | null>(null);
  const [decoded, setDecoded] = React.useState<number[] | null>(null);
  const [rateIndex, setRateIndex] = React.useState(0);
  const seekingRef = React.useRef(false);

  const duration = durationHint ?? metaDuration ?? 0;
  const peaks = peaksProp ?? decoded ?? placeholderPeaks(bars);
  const rate = rates[rateIndex] ?? 1;

  // Decode the waveform only when the consumer didn't supply one.
  React.useEffect(() => {
    if (peaksProp) return;
    let alive = true;
    void extractPeaks(src, bars).then((p) => {
      if (alive && p) setDecoded(p);
    });
    return () => {
      alive = false;
    };
  }, [src, bars, peaksProp]);

  React.useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = rate;
  }, [rate]);

  const onLoadedMetadata = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (Number.isFinite(audio.duration)) {
      setMetaDuration(audio.duration);
    } else if (durationHint === undefined) {
      // MediaRecorder WebM: duration only materializes after seeking past the end.
      const fix = () => {
        if (Number.isFinite(audio.duration)) setMetaDuration(audio.duration);
        audio.currentTime = 0;
        audio.removeEventListener('durationchange', fix);
      };
      audio.addEventListener('durationchange', fix);
      audio.currentTime = Number.MAX_SAFE_INTEGER;
    }
  };

  const play = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (exclusive) {
      pauseCurrent?.();
      pauseCurrent = () => audio.pause();
    }
    audio.playbackRate = rate;
    void audio.play();
  };

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) play();
    else audio.pause();
  };

  const seekTo = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(duration) || duration <= 0) return;
    const t = Math.min(Math.max(seconds, 0), duration);
    audio.currentTime = t;
    setCurrent(t);
  };

  const seekFromPointer = (e: React.PointerEvent) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    seekTo(ratio * duration);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const jump = { ArrowRight: 5, ArrowLeft: -5, ArrowUp: 5, ArrowDown: -5 }[e.key];
    if (jump !== undefined) seekTo(current + jump);
    else if (e.key === 'Home') seekTo(0);
    else if (e.key === 'End') seekTo(duration);
    else if (e.key === ' ' || e.key === 'Enter') toggle();
    else return;
    e.preventDefault();
  };

  const progress = duration > 0 ? current / duration : 0;
  const played = progress * peaks.length;

  return (
    <div
      className={cn(
        'flex w-full min-w-0 items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2',
        className,
      )}
      {...props}
    >
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- audio-only player, UI is custom */}
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        autoPlay={autoPlay}
        onLoadedMetadata={onLoadedMetadata}
        onTimeUpdate={() => {
          if (!seekingRef.current) setCurrent(audioRef.current?.currentTime ?? 0);
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrent(0);
          onEnded?.();
        }}
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Pause' : 'Play'}
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full text-white transition-transform active:scale-95',
          BAR_TONES[tone],
          tone === 'neutral' && 'text-background',
        )}
      >
        {playing ? (
          <Pause className="size-4" fill="currentColor" strokeWidth={0} />
        ) : (
          <Play className="ml-0.5 size-4" fill="currentColor" strokeWidth={0} />
        )}
      </button>

      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(current)}
        aria-valuetext={`${fmtTime(current)} of ${fmtTime(duration)}`}
        onKeyDown={onKeyDown}
        onPointerDown={(e) => {
          seekingRef.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          seekFromPointer(e);
        }}
        onPointerMove={(e) => {
          if (seekingRef.current) seekFromPointer(e);
        }}
        onPointerUp={() => {
          seekingRef.current = false;
        }}
        onPointerCancel={() => {
          seekingRef.current = false;
        }}
        className="flex h-10 min-w-0 flex-1 cursor-pointer touch-none items-center gap-px rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {peaks.map((p, i) => (
          <span
            key={i}
            className={cn(
              'min-h-[3px] w-full min-w-px flex-1 rounded-full transition-colors duration-75',
              i < played ? BAR_TONES[tone] : 'bg-foreground/20',
            )}
            style={{ height: `${Math.max(8, Math.min(100, p * 100))}%` }}
          />
        ))}
      </div>

      <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
        {playing || current > 0 ? fmtTime(current) : fmtTime(duration)}
      </span>

      {rates.length > 1 && (
        <button
          type="button"
          onClick={() => setRateIndex((i) => (i + 1) % rates.length)}
          aria-label={`Playback speed ${rate}x`}
          className="shrink-0 rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] font-medium text-muted-foreground tabular-nums transition-colors active:bg-accent"
        >
          {rate}×
        </button>
      )}
    </div>
  );
}
