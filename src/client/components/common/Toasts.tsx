import { useToastStore } from '../../store/toastStore';
import { cx } from './ui';

const KIND_CLASS = {
  info: 'border-gray-300 bg-white text-gray-800',
  success: 'border-brand-300 bg-brand-50 text-brand-900',
  error: 'border-red-300 bg-red-50 text-red-900',
} as const;

/** Stack of transient notifications in the bottom-right corner. */
export function Toasts() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-20 z-[60] flex flex-col gap-2 sm:inset-x-auto sm:right-4 sm:w-80 " aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={cx('pointer-events-auto rounded-md border px-3 py-2 text-sm shadow-md', KIND_CLASS[toast.kind])} role="status">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <div>{toast.message}</div>
              {toast.details && toast.details.length > 0 && (
                <ul className="mt-1 list-disc pl-4 text-xs opacity-90">
                  {toast.details.slice(0, 8).map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                  {toast.details.length > 8 && <li>… e mais {toast.details.length - 8}</li>}
                </ul>
              )}
            </div>
            <button type="button" className="text-xs opacity-60 hover:opacity-100" onClick={() => dismiss(toast.id)} aria-label="Fechar aviso">
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
