import { create } from 'zustand';

export type ConfirmRequest = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  promptLabel?: string;
  promptType?: 'text' | 'password';
  promptMinLength?: number;
};

type ConfirmState = {
  request: (ConfirmRequest & { resolve: (value: string | null) => void }) | null;
  open: (request: ConfirmRequest) => Promise<string | null>;
  resolve: (value: string | null) => void;
};

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  request: null,
  open: (request) =>
    new Promise<string | null>((resolve) => {
      const previous = get().request;
      if (previous) previous.resolve(null);
      set({ request: { ...request, resolve } });
    }),
  resolve: (value) => {
    const current = get().request;
    if (!current) return;
    set({ request: null });
    current.resolve(value);
  },
}));

/** Opens a confirmation dialog and resolves true when the user confirms. */
export async function confirmDialog(request: ConfirmRequest): Promise<boolean> {
  const value = await useConfirmStore.getState().open(request);
  return value !== null;
}

/** Opens a dialog with a text field and resolves with the typed value, or null when cancelled. */
export async function promptDialog(request: ConfirmRequest & { promptLabel: string }): Promise<string | null> {
  return useConfirmStore.getState().open(request);
}
