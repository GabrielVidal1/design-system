import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Pause, Play, Volume2, VolumeX } from 'lucide-react';

/**
 * A video slide inside the full-screen viewer.
 *
 * It is the *clock* for its own slide: in story mode the progress bar tracks
 * the video's `currentTime / duration` rather than a wall-clock timer, so a
 * clip that buffers doesn't desync from the bar, and the slide advances exactly
 * when the clip ends.
 *
 * Sound starts muted — browsers block unmuted autoplay, and a story that shouts
 * on open is a worse default than one you tap to hear.
 */
export interface ViewerVideoHandle {
  play: () => void;
  pause: () => void;
  /** 0→1 completion, or 0 while the duration is still unknown. */
  progress: () => number;
}

export const ViewerVideo = forwardRef<
  ViewerVideoHandle,
  {
    src: string;
    poster?: string;
    /** Whether this slide is the visible one (an off-slide video must not play). */
    active: boolean;
    /** Story mode holds playback while the user long-presses. */
    paused: boolean;
    /** Story mode advances when the clip ends; the manual viewer just loops. */
    story: boolean;
    onEnded: () => void;
    /** Story mode needs a duration to size its bar; report it once known. */
    onDuration?: (seconds: number) => void;
  }
>(function ViewerVideo({ src, poster, active, paused, story, onEnded, onDuration }, ref) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [manualPaused, setManualPaused] = useState(false);

  useImperativeHandle(ref, () => ({
    play: () => void videoRef.current?.play().catch(() => {}),
    pause: () => videoRef.current?.pause(),
    progress: () => {
      const el = videoRef.current;
      if (!el || !el.duration || !Number.isFinite(el.duration)) return 0;
      return el.currentTime / el.duration;
    },
  }));

  // React's `muted` prop doesn't survive re-renders reliably; set the property.
  useEffect(() => {
    const el = videoRef.current;
    if (el) el.muted = muted;
  }, [muted]);

  // Play only while this slide is on screen and nothing is holding it.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (active && !paused && !manualPaused) {
      void el.play().catch(() => {
        /* autoplay refused (low-power mode): the play button takes over */
      });
    } else {
      el.pause();
      // Leaving a slide rewinds it, so coming back replays from the top.
      if (!active) el.currentTime = 0;
    }
  }, [active, paused, manualPaused]);

  return (
    <div className="viewer-video-wrap">
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        // Outside story mode there is nothing to advance to, so a clip loops
        // until the user moves on themselves.
        loop={!story}
        playsInline
        preload="metadata"
        className="viewer-video"
        onEnded={story ? onEnded : undefined}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d)) onDuration?.(d);
        }}
      />

      <div className="viewer-media-ctls">
        <button
          type="button"
          className="viewer-ctl"
          onClick={(e) => {
            e.stopPropagation();
            setManualPaused((p) => !p);
          }}
          aria-label={manualPaused ? 'Play' : 'Pause'}
        >
          {manualPaused ? <Play /> : <Pause />}
        </button>
        <button
          type="button"
          className="viewer-ctl"
          onClick={(e) => {
            e.stopPropagation();
            setMuted((m) => !m);
          }}
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? <VolumeX /> : <Volume2 />}
        </button>
      </div>
    </div>
  );
});
