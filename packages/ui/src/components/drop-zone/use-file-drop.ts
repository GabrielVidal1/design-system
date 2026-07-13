import * as React from 'react';

export interface FileRejection {
  file: File;
  reason: 'type' | 'size' | 'count';
}

export interface UseFileDropOptions {
  onFiles: (files: File[]) => void;
  /** Same syntax as `<input accept>`: `image/*,.glb`. */
  accept?: string;
  multiple?: boolean;
  maxFiles?: number;
  /** Per-file cap, in bytes. */
  maxSize?: number;
  /** Walk dropped folders recursively (Chromium/WebKit). */
  recursive?: boolean;
  disabled?: boolean;
  onReject?: (rejections: FileRejection[]) => void;
}

/**
 * The headless half of `<DropZone>`: drag state, the click-to-browse input, and
 * validation. Spread `rootProps` on any element to make it a drop target.
 *
 * Drag events fire for every child element, so the depth counter is what keeps
 * the highlight from flickering as the pointer crosses them.
 */
export function useFileDrop({
  onFiles,
  accept,
  multiple = true,
  maxFiles,
  maxSize,
  recursive = false,
  disabled = false,
  onReject,
}: UseFileDropOptions) {
  const [dragging, setDragging] = React.useState(false);
  const depth = React.useRef(0);
  const input = React.useRef<HTMLInputElement>(null);

  const accepts = React.useMemo(() => parseAccept(accept), [accept]);

  const take = React.useCallback(
    (list: File[]) => {
      const kept: File[] = [];
      const rejected: FileRejection[] = [];

      for (const file of list) {
        if (!matches(file, accepts)) rejected.push({ file, reason: 'type' });
        else if (maxSize != null && file.size > maxSize) rejected.push({ file, reason: 'size' });
        else if (maxFiles != null && kept.length >= maxFiles) rejected.push({ file, reason: 'count' });
        else if (!multiple && kept.length >= 1) rejected.push({ file, reason: 'count' });
        else kept.push(file);
      }

      if (rejected.length) onReject?.(rejected);
      if (kept.length) onFiles(kept);
    },
    [accepts, maxFiles, maxSize, multiple, onFiles, onReject],
  );

  const reset = () => {
    depth.current = 0;
    setDragging(false);
  };

  const rootProps = {
    onDragEnter: (e: React.DragEvent) => {
      if (disabled || !isFileDrag(e.dataTransfer)) return;
      e.preventDefault();
      depth.current += 1;
      setDragging(true);
    },
    onDragOver: (e: React.DragEvent) => {
      if (disabled || !isFileDrag(e.dataTransfer)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    },
    onDragLeave: (e: React.DragEvent) => {
      if (disabled || !isFileDrag(e.dataTransfer)) return;
      e.preventDefault();
      depth.current -= 1;
      if (depth.current <= 0) reset();
    },
    onDrop: async (e: React.DragEvent) => {
      if (disabled || !isFileDrag(e.dataTransfer)) return;
      e.preventDefault();
      reset();
      // Read the flat list up front: the DataTransfer is dead once we await.
      const plain = [...e.dataTransfer.files];
      // The entries API is the only way to see inside a dropped folder, but it
      // is non-standard — where it gives us nothing, take the flat list.
      const walked = recursive ? await walkItems(e.dataTransfer.items) : [];
      take(walked.length > 0 ? walked : plain);
    },
  };

  const inputProps = {
    ref: input,
    type: 'file' as const,
    accept,
    multiple,
    disabled,
    className: 'hidden',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      take([...(e.target.files ?? [])]);
      e.target.value = ''; // so picking the same file twice fires again
    },
  };

  /** Open the OS file picker. */
  const open = React.useCallback(() => input.current?.click(), []);

  return { dragging, rootProps, inputProps, open };
}

/**
 * A drag only concerns us when it carries files. Text dragged from elsewhere on
 * the page reports no `Files` type, and must be left alone so it can still drop
 * into whatever the zone wraps (a textarea, say).
 */
function isFileDrag(dt: DataTransfer | null): boolean {
  return !!dt && Array.from(dt.types ?? []).includes('Files');
}

function parseAccept(accept?: string): string[] {
  return accept
    ? accept
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    : [];
}

function matches(file: File, accepts: string[]): boolean {
  if (accepts.length === 0) return true;
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return accepts.some((a) =>
    a.startsWith('.')
      ? name.endsWith(a)
      : a.endsWith('/*')
        ? type.startsWith(a.slice(0, -1))
        : type === a,
  );
}

/* ─── Folder drops ────────────────────────────────────────────────────────────
 * `dataTransfer.files` flattens a dropped folder to nothing. The entries API is
 * the only way to read one, and it is non-standard — hence the `any`s and the
 * silent bail on browsers that lack it.
 */
async function walkItems(items: DataTransferItemList): Promise<File[]> {
  const entries = [...items]
    .map((item) => (item as any).webkitGetAsEntry?.())
    .filter(Boolean);
  if (entries.length === 0) return [];

  const out: File[] = [];
  await Promise.all(entries.map((entry: any) => walk(entry, out)));
  return out;
}

async function walk(entry: any, out: File[]): Promise<void> {
  if (entry.isFile) {
    const file = await new Promise<File | null>((resolve) =>
      entry.file(resolve, () => resolve(null)),
    );
    if (file) out.push(file);
    return;
  }
  if (!entry.isDirectory) return;

  const reader = entry.createReader();
  // readEntries pages at ~100 entries — keep reading until it returns nothing.
  for (;;) {
    const batch: any[] = await new Promise((resolve) =>
      reader.readEntries(resolve, () => resolve([])),
    );
    if (batch.length === 0) return;
    await Promise.all(batch.map((child) => walk(child, out)));
  }
}
