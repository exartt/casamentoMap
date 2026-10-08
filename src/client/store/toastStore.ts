import { create } from 'zustand';

export type ToastKind = 'info' | 'success' | 'error';

export type Toast = { id: number; kind: ToastKind; message: string; details?: string[] };

const DEFAULT_DURATION_MS = 4000;

const ERROR_DURATION_MS = 8000;

type ToastState = {
  toasts: Toast[];
  push: (kind: ToastKind, message: string, details?: string[]) => void;
  dismiss: (id: number) => void;
};

let nextId = 1;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (kind, message, details) => {
    const id = nextId;
    nextId += 1;
    set({ toasts: [...get().toasts, { id, kind, message, details }] });
    setTimeout(() => get().dismiss(id), kind === 'error' ? ERROR_DURATION_MS : DEFAULT_DURATION_MS);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

/** Shows an informational toast. */
export function toastInfo(message: string): void {
  useToastStore.getState().push('info', message);
}

/** Shows a success toast. */
export function toastSuccess(message: string): void {
  useToastStore.getState().push('success', message);
}

/** Shows an error toast with optional detail lines. */
export function toastError(message: string, details?: string[]): void {
  useToastStore.getState().push('error', message, details);
}
