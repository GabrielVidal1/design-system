import type { CSSProperties, ReactNode } from 'react';
import { BatteryFull, Signal, Wifi } from 'lucide-react';

/**
 * Faux iOS status bar for the top of a {@link PhonePreview} screen: time on the
 * left, signal / Wi-Fi / battery on the right, the centre left clear for the
 * dynamic island. Decorative only. Reads `--foreground` / `--background` so it
 * inherits the screen's theme, with light-mode fallbacks.
 */
export function IOSStatusBar({ time = '9:41', className }: { time?: string; className?: string }) {
  return (
    <div
      aria-hidden
      className={className}
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 30,
        display: 'flex',
        height: 34,
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 22px',
        userSelect: 'none',
        color: 'var(--foreground, #0c0a09)',
        background: 'var(--background, #fff)',
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{time}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <Signal size={15} />
        <Wifi size={15} />
        <BatteryFull size={22} />
      </div>
    </div>
  );
}

export interface PhonePreviewProps {
  /** Screen content. Ignored when `src` is set. */
  children?: ReactNode;
  /**
   * Render a live app inside the screen. The iframe is laid out at
   * `deviceWidth` (a real phone's logical width) then scaled down to the frame,
   * so the embedded app lays out exactly as it does on a device instead of
   * reflowing to the narrow mockup width.
   */
  src?: string;
  title?: string;
  /** Rendered width of the screen, in px (the frame sizes off this). */
  screenWidth?: number;
  /** Logical device width the `src` iframe is laid out at before scaling. */
  deviceWidth?: number;
  /** Logical device height, for the screen aspect ratio. */
  deviceHeight?: number;
  /** Frame / bezel colour. */
  frameColor?: string;
  /** Show a dynamic-island pill at the top of the screen. */
  island?: boolean;
  /** Prepend an {@link IOSStatusBar} (only meaningful with `children`). */
  statusBar?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * A dependency-free iPhone mockup. Drop any React tree in as `children` to frame
 * a screen, or pass `src` to embed a live app as a scaled iframe (the technique
 * the note-vite and insta-pics landing pages use). Pure inline styles — no
 * Tailwind required.
 *
 * @summary iPhone-style device frame around children or a `src` URL, with dynamic
 * island and status bar.
 */
export function PhonePreview({
  children,
  src,
  title = 'Phone preview',
  screenWidth = 300,
  deviceWidth = 390,
  deviceHeight = 844,
  frameColor = '#1f2933',
  island = true,
  statusBar = false,
  className,
  style,
}: PhonePreviewProps) {
  const screenHeight = Math.round((screenWidth * deviceHeight) / deviceWidth);
  const unit = screenWidth / 300; // scale every fixed dimension off a 300px baseline
  const bezel = Math.round(12 * unit);
  const outerRadius = Math.round(54 * unit);
  const screenRadius = Math.round(screenWidth * 0.14);
  const scale = screenWidth / deviceWidth;

  const islandEl = island && (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        top: Math.round(9 * unit),
        left: '50%',
        transform: 'translateX(-50%)',
        width: Math.round(screenWidth * 0.34),
        height: Math.round(28 * unit),
        borderRadius: 999,
        background: '#05070a',
        zIndex: 40,
      }}
    />
  );

  return (
    <div className={className} style={{ width: screenWidth + bezel * 2, ...style }}>
      <div
        style={{
          padding: bezel,
          background: frameColor,
          borderRadius: outerRadius,
          boxShadow: `0 0 0 ${Math.max(1, Math.round(unit))}px rgba(255,255,255,0.06), 0 24px 60px -20px rgba(0,0,0,0.7)`,
        }}
      >
        <div
          style={{
            position: 'relative',
            width: screenWidth,
            height: screenHeight,
            overflow: 'hidden',
            borderRadius: screenRadius,
            background: 'var(--background, #fff)',
          }}
        >
          {islandEl}
          {src ? (
            <iframe
              src={src}
              title={title}
              loading="lazy"
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                border: 0,
                width: deviceWidth,
                height: `${100 / scale}%`,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                background: 'var(--background, #fff)',
              }}
            />
          ) : (
            <div style={{ position: 'absolute', inset: 0, overflow: 'auto' }}>
              {statusBar && <IOSStatusBar />}
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
