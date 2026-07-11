import { useCallback, useState } from 'react';

import type { RichFile } from './types';

/** Turn a browser File into a local RichFile (used when no uploader is given). */
function localFile(file: File, i: number): RichFile {
  const url =
    typeof URL !== 'undefined' && file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
  return {
    id: `${file.name}:${file.size}:${file.lastModified}:${i}`,
    name: file.name,
    size: file.size,
    contentType: file.type || 'application/octet-stream',
    url,
    meta: file,
  };
}

/** Does `accept` (an <input accept> string) admit this file? */
function acceptsFile(accept: string | undefined, file: File): boolean {
  if (!accept) return true;
  const parts = accept.split(',').map((p) => p.trim().toLowerCase()).filter(Boolean);
  if (parts.length === 0) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return parts.some((p) => {
    if (p.startsWith('.')) return name.endsWith(p);
    if (p.endsWith('/*')) return type.startsWith(p.slice(0, -1));
    return type === p;
  });
}

export interface FileUpload {
  files: RichFile[];
  uploading: boolean;
  error: string | null;
  add: (list: FileList | File[] | null) => Promise<void>;
  remove: (id: string) => void;
  reset: () => void;
  setFiles: (files: RichFile[]) => void;
}

export function useFileUpload({
  upload,
  accept,
  maxFiles,
  filter,
}: {
  upload?: (files: File[]) => Promise<RichFile[]>;
  accept?: string;
  maxFiles?: number;
  /** Return `true` to keep, `false`/reason-string to reject a file. */
  filter?: (file: File) => boolean | string;
}): FileUpload {
  const [files, setFilesState] = useState<RichFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = useCallback(
    async (list: FileList | File[] | null) => {
      const picked = Array.from(list ?? []);
      if (picked.length === 0) return;
      setError(null);

      const kept: File[] = [];
      for (const f of picked) {
        if (!acceptsFile(accept, f)) {
          setError(`${f.name}: type not accepted`);
          continue;
        }
        const verdict = filter?.(f);
        if (verdict === false) {
          setError(`${f.name}: rejected`);
          continue;
        }
        if (typeof verdict === 'string') {
          setError(`${f.name}: ${verdict}`);
          continue;
        }
        kept.push(f);
      }
      if (kept.length === 0) return;

      const room = maxFiles == null ? kept.length : Math.max(0, maxFiles - files.length);
      if (room <= 0) {
        setError(`At most ${maxFiles} file${maxFiles === 1 ? '' : 's'}`);
        return;
      }
      const admitted = kept.slice(0, room);
      if (admitted.length < kept.length) setError(`At most ${maxFiles} files`);

      if (!upload) {
        setFilesState((prev) => [...prev, ...admitted.map(localFile)]);
        return;
      }

      setUploading(true);
      try {
        const stored = await upload(admitted);
        setFilesState((prev) => [...prev, ...stored]);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setUploading(false);
      }
    },
    [accept, maxFiles, filter, upload, files.length],
  );

  const remove = useCallback((id: string) => {
    setFilesState((prev) => {
      const gone = prev.find((f) => f.id === id);
      if (gone?.url?.startsWith('blob:')) URL.revokeObjectURL(gone.url);
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  const reset = useCallback(() => {
    setFilesState((prev) => {
      for (const f of prev) if (f.url?.startsWith('blob:')) URL.revokeObjectURL(f.url);
      return [];
    });
    setError(null);
  }, []);

  return { files, uploading, error, add, remove, reset, setFiles: setFilesState };
}
