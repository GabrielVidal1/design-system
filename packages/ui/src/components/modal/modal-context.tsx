import * as React from 'react';

import { Button } from '../button';
import { Modal, type ModalSize } from './modal';

export interface ModalSpec {
  title?: React.ReactNode;
  description?: React.ReactNode;
  content?: React.ReactNode;
  footer?: React.ReactNode;
  size?: ModalSize;
  dismissable?: boolean;
  onClose?: () => void;
}

export interface ConfirmSpec {
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button, for deletes. */
  destructive?: boolean;
}

interface ModalApi {
  open: (spec: ModalSpec) => string;
  close: (id?: string) => void;
  confirm: (spec: ConfirmSpec) => Promise<boolean>;
}

const ModalCtx = React.createContext<ModalApi | null>(null);

interface Entry extends ModalSpec {
  id: string;
}

/**
 * Imperative modals: open one from an event handler, no `useState` per dialog.
 * Also backs `useConfirm`, so `window.confirm` can go.
 */
export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [stack, setStack] = React.useState<Entry[]>([]);
  const seq = React.useRef(0);

  const close = React.useCallback((id?: string) => {
    setStack((prev) => {
      const target = id == null ? prev[prev.length - 1] : prev.find((m) => m.id === id);
      target?.onClose?.();
      return id == null ? prev.slice(0, -1) : prev.filter((m) => m.id !== id);
    });
  }, []);

  const open = React.useCallback((spec: ModalSpec) => {
    const id = `m${(seq.current += 1)}`;
    setStack((prev) => [...prev, { ...spec, id }]);
    return id;
  }, []);

  const confirm = React.useCallback(
    (spec: ConfirmSpec) =>
      new Promise<boolean>((resolve) => {
        const id = `m${(seq.current += 1)}`;
        const settle = (answer: boolean) => {
          setStack((prev) => prev.filter((m) => m.id !== id));
          resolve(answer);
        };
        setStack((prev) => [
          ...prev,
          {
            id,
            title: spec.title,
            description: spec.description,
            size: 'sm',
            // A dismiss (Escape / scrim / ✕) is a "no", never a silent hang.
            onClose: () => resolve(false),
            footer: (
              <>
                <Button variant="ghost" size="sm" onClick={() => settle(false)}>
                  {spec.cancelLabel ?? 'Cancel'}
                </Button>
                <Button
                  variant={spec.destructive ? 'destructive' : 'default'}
                  size="sm"
                  onClick={() => settle(true)}
                >
                  {spec.confirmLabel ?? 'Confirm'}
                </Button>
              </>
            ),
          },
        ]);
      }),
    [],
  );

  const api = React.useMemo<ModalApi>(() => ({ open, close, confirm }), [open, close, confirm]);

  return (
    <ModalCtx.Provider value={api}>
      {children}
      {stack.map((m) => (
        <Modal
          key={m.id}
          open
          onClose={() => close(m.id)}
          title={m.title}
          description={m.description}
          footer={m.footer}
          size={m.size}
          dismissable={m.dismissable}
        >
          {m.content}
        </Modal>
      ))}
    </ModalCtx.Provider>
  );
}

function useModalApi(hook: string): ModalApi {
  const ctx = React.useContext(ModalCtx);
  if (!ctx) throw new Error(`${hook} must be used inside a <ModalProvider>`);
  return ctx;
}

/** `const modal = useModal(); modal.open({ title, content })`. */
export function useModal(): ModalApi {
  return useModalApi('useModal');
}

/** `if (await confirm({ title: 'Delete note?', destructive: true })) …`. */
export function useConfirm(): (spec: ConfirmSpec) => Promise<boolean> {
  return useModalApi('useConfirm').confirm;
}
