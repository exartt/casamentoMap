import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { btn, cx } from './ui';

export type MenuItem = { label: string; onSelect: () => void; disabled?: boolean; danger?: boolean } | { separator: true };

type Props = {
  label: ReactNode;
  items: MenuItem[];
  align?: 'left' | 'right';
  ariaLabel?: string;
  className?: string;
  buttonClassName?: string;
  hideChevron?: boolean;
};

/** Dropdown menu button with keyboard support and click-outside closing. */
export function Menu({ label, items, align = 'left', ariaLabel, className, buttonClassName, hideChevron = false }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={cx('relative', className)}>
      <button
        type="button"
        className={cx(btn.base, btn.secondary, buttonClassName)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
        {!hideChevron && (
          <span aria-hidden="true" className="text-xs">
            ▾
          </span>
        )}
      </button>
      {open && (
        <div
          id={id}
          role="menu"
          className={cx('absolute z-40 mt-1 max-h-[75dvh] min-w-[13rem] overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg', align === 'right' ? 'right-0' : 'left-0')}
        >
          {items.map((item, i) =>
            'separator' in item ? (
              <div key={i} className="my-1 border-t border-gray-200" role="separator" />
            ) : (
              <button
                key={i}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                className={cx(
                  'block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 disabled:opacity-50 [@media(pointer:coarse)]:py-3 [@media(pointer:coarse)]:text-base',
                  item.danger ? 'text-red-700' : 'text-gray-800',
                )}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
              >
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
