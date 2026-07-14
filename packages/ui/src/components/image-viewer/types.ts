/** What a viewer slide actually is. */
export type ViewerMediaKind = 'image' | 'video';

/**
 * One slide in the full-screen viewer.
 *
 * The viewer accepts a bare `string[]` too — a URL is shorthand for
 * `{ kind: 'image', src }` — so the image-only call sites that predate video
 * keep working untouched.
 */
export interface ViewerMedia {
  kind: ViewerMediaKind;
  /** The image to show, or the video to play. */
  src: string;
  /**
   * A still to paint before the media itself is ready: the blurred thumbnail
   * under a loading image, or a video's poster frame.
   */
  poster?: string;
  /** Alt text for an image slide. */
  alt?: string;
  /**
   * How long this slide is shown before story mode advances, in ms. Ignored
   * outside story mode. A video's own duration wins over this; it only applies
   * to a video whose metadata never loads.
   */
  durationMs?: number;
}

/** Options for a single {@link useImageViewer} `open()` call. */
export interface ViewerOptions {
  /** Slide to start on (default 0). */
  index?: number;
  /**
   * Story mode: slides auto-advance behind a segmented progress bar (the
   * Instagram/Snapchat pattern). Images hold for `durationMs` (or
   * {@link ViewerOptions.imageDurationMs}); a video plays to its end. Tap-hold
   * anywhere pauses; tapping the left/right third steps back/forward; the
   * viewer closes when the last slide finishes.
   *
   * Off by default — the plain viewer stays a manual zoom/pan gallery.
   */
  story?: boolean;
  /** How long an image is held in story mode when it sets no `durationMs`. Default 5000. */
  imageDurationMs?: number;
  /** In story mode, called when the last slide finishes (before the auto-close). */
  onComplete?: () => void;
}

/** Normalize the `string | ViewerMedia` union the public API accepts. */
export function toViewerMedia(item: string | ViewerMedia): ViewerMedia {
  return typeof item === 'string' ? { kind: 'image', src: item } : item;
}
