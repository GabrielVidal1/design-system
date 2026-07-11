import * as React from 'react';
import { Upload } from 'lucide-react';

import { cn } from '../../lib/utils';
import { useFileDrop, type UseFileDropOptions } from './use-file-drop';

export interface DropZoneProps extends UseFileDropOptions {
  /** Headline inside the zone. */
  label?: React.ReactNode;
  /** Small print — say what you accept and how big. */
  hint?: React.ReactNode;
  /** Replaces the default body entirely. Gets the live drag state. */
  children?: (state: { dragging: boolean; open: () => void }) => React.ReactNode;
  className?: string;
}

/**
 * A drag-and-drop file target that also clicks through to the file picker, with
 * the whole-window drag highlight and folder support behind one prop.
 */
export function DropZone({
  label = 'Drop files here',
  hint,
  children,
  className,
  ...options
}: DropZoneProps) {
  const { dragging, rootProps, inputProps, open } = useFileDrop(options);

  return (
    <div
      {...rootProps}
      onClick={options.disabled ? undefined : open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
      role="button"
      tabIndex={options.disabled ? -1 : 0}
      aria-disabled={options.disabled}
      className={cn(
        'relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border px-6 py-10 text-center transition-colors outline-none',
        'hover:border-ring/60 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring',
        dragging && 'border-ring bg-muted/60',
        options.disabled && 'pointer-events-none opacity-50',
        className,
      )}
    >
      <input {...inputProps} />
      {children ? (
        children({ dragging, open })
      ) : (
        <>
          <Upload
            className={cn(
              'size-6 text-muted-foreground transition-transform',
              dragging && 'scale-110 text-foreground',
            )}
          />
          <p className="text-sm font-medium text-foreground">{label}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </>
      )}
    </div>
  );
}
