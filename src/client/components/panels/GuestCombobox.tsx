import { Combobox, ComboboxButton, ComboboxInput, ComboboxOption, ComboboxOptions } from '@headlessui/react';
import { forwardRef, useMemo, useState } from 'react';
import { matchesSearch } from '@shared/domain/text';
import type { Guest } from '@shared/domain/types';
import { t } from '../../i18n/strings';
import { cx, input } from '../common/ui';

type Props = {
  guests: Guest[];
  value: Guest | null;
  onChange: (guest: Guest | null) => void;
  placeholder?: string;
  ariaLabel: string;
  disabled?: boolean;
  compact?: boolean;
};

const MAX_OPTIONS = 60;

/** Accessible combobox that lists guests filtered without accents or case. */
export const GuestCombobox = forwardRef<HTMLInputElement, Props>(function GuestCombobox(
  { guests, value, onChange, placeholder, ariaLabel, disabled, compact },
  ref,
) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const list = query === '' ? guests : guests.filter((g) => matchesSearch(g.name, query));
    return list.slice(0, MAX_OPTIONS);
  }, [guests, query]);

  return (
    <Combobox value={value} onChange={onChange} onClose={() => setQuery('')} disabled={disabled} immediate>
      <div className="relative">
        <ComboboxInput
          ref={ref}
          aria-label={ariaLabel}
          className={cx(input, compact && 'py-1 text-xs', 'pr-7')}
          displayValue={(g: Guest | null) => g?.name ?? ''}
          placeholder={placeholder ?? t.table.selectGuest}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
        <ComboboxButton className="absolute inset-y-0 right-0 flex items-center px-2 text-gray-500" aria-label={t.app.search}>
          ▾
        </ComboboxButton>
      </div>
      <ComboboxOptions
        anchor="bottom start"
        className="z-50 max-h-60 w-[var(--input-width)] overflow-auto rounded-md border border-gray-200 bg-white py-1 text-sm shadow-lg [--anchor-gap:4px] empty:invisible"
      >
        {filtered.map((g) => (
          <ComboboxOption key={g.id} value={g} className="cursor-pointer px-3 py-1.5 data-[focus]:bg-brand-50 data-[selected]:font-semibold">
            <span>{g.name}</span>
            {g.group && <span className="ml-2 text-xs text-gray-500">{g.group}</span>}
          </ComboboxOption>
        ))}
        {filtered.length === 0 && <div className="px-3 py-1.5 text-xs text-gray-500">{t.guests.noResults}</div>}
      </ComboboxOptions>
    </Combobox>
  );
});
