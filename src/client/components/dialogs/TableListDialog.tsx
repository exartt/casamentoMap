import { useMemo, useState } from 'react';
import { tableOccupancy } from '@shared/domain/seating';
import { compareNames, matchesSearch } from '@shared/domain/text';
import type { ProjectData } from '@shared/domain/types';
import { t } from '../../i18n/strings';
import { colorForGroup, getDerived } from '../../store/derived';
import { useProjectStore } from '../../store/projectStore';
import { toastSuccess } from '../../store/toastStore';
import { useUiStore } from '../../store/uiStore';
import { btn, cx, input } from '../common/ui';
import { Modal } from './Modal';

type Props = { project: ProjectData; onClose: () => void };

/** Overview of every table with its current label and the names seated at each numbered seat. */
export function TableListDialog({ project, onClose }: Props) {
  const derived = getDerived(project);
  const [filter, setFilter] = useState('');
  const [hideEmptySeats, setHideEmptySeats] = useState(false);
  const setSelection = useProjectStore((s) => s.setSelection);
  const requestFocus = useUiStore((s) => s.requestFocus);

  const tables = useMemo(() => {
    const sorted = [...project.tables].sort((a, b) => compareNames(a.label, b.label));
    if (filter.trim() === '') return sorted;
    return sorted.filter((table) => {
      if (matchesSearch(table.label, filter)) return true;
      return table.seats.some((s) => s.guestId && matchesSearch(derived.guestsById.get(s.guestId)?.name ?? '', filter));
    });
  }, [project.tables, filter, derived]);

  const copyText = async () => {
    const lines: string[] = [];
    for (const table of project.tables) {
      const occ = tableOccupancy(table);
      lines.push(`${table.label} (${occ.occupied}/${occ.enabled})`);
      for (const seat of table.seats) {
        if (!seat.enabled) continue;
        const name = seat.guestId ? derived.guestsById.get(seat.guestId)?.name ?? '' : '';
        if (name === '' && hideEmptySeats) continue;
        lines.push(`  ${seat.index + 1}. ${name || t.print.emptySeat}`);
      }
      lines.push('');
    }
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      toastSuccess(t.tableList.copied);
    } catch {
      return;
    }
  };

  return (
    <Modal
      title={t.tableList.title}
      open
      onClose={onClose}
      size="xl"
      footer={
        <>
          <button type="button" className={cx(btn.base, btn.secondary)} onClick={() => void copyText()}>
            {t.tableList.copy}
          </button>
          <button type="button" className={cx(btn.base, btn.primary)} onClick={onClose}>
            {t.app.close}
          </button>
        </>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input type="search" className={cx(input, 'max-w-xs')} placeholder={t.tableList.filter} value={filter} onChange={(e) => setFilter(e.target.value)} aria-label={t.tableList.filter} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 rounded border-gray-300" checked={hideEmptySeats} onChange={(e) => setHideEmptySeats(e.target.checked)} />
          {t.tableList.hideEmpty}
        </label>
        <span className="text-xs text-gray-500">{t.tableList.count(tables.length, project.tables.length)}</span>
      </div>
      {tables.length === 0 && <p className="text-sm text-gray-600">{t.tableList.empty}</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tables.map((table) => {
          const occ = tableOccupancy(table);
          return (
            <section key={table.id} className={cx('rounded-md border p-3', table.highlight ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white')}>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <button
                  type="button"
                  className="truncate text-left text-sm font-semibold text-brand-800 hover:underline"
                  onClick={() => {
                    setSelection([table.id]);
                    requestFocus({ type: 'table', id: table.id });
                    onClose();
                  }}
                  title={t.tableList.showOnPlan}
                >
                  {table.label}
                </button>
                <span className="shrink-0 text-xs text-gray-500">
                  {occ.occupied}/{occ.enabled}
                </span>
              </div>
              <ol className="text-sm">
                {table.seats.map((seat) => {
                  if (!seat.enabled) return null;
                  const guest = seat.guestId ? derived.guestsById.get(seat.guestId) : undefined;
                  if (!guest && hideEmptySeats) return null;
                  const highlighted = filter.trim() !== '' && guest !== undefined && matchesSearch(guest.name, filter);
                  return (
                    <li key={seat.index} className={cx('flex items-center gap-2 py-0.5', highlighted && 'rounded bg-pink-100')}>
                      <span className="w-5 text-right text-xs tabular-nums text-gray-500">{seat.index + 1}.</span>
                      {guest ? (
                        <>
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: colorForGroup(derived, guest.group) }} aria-hidden="true" />
                          <span className="truncate">{guest.name}</span>
                          {guest.isChild && <span className="text-xs text-gray-500">({t.guests.child})</span>}
                        </>
                      ) : (
                        <span className="text-gray-400">{t.print.emptySeat}</span>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
      </div>
    </Modal>
  );
}
