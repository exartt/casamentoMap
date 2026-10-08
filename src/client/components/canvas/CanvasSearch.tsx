import { useMemo } from 'react';
import type { ProjectData } from '@shared/domain/types';
import { t } from '../../i18n/strings';
import { getDerived, searchSeatedGuests } from '../../store/derived';
import { useProjectStore } from '../../store/projectStore';
import { useUiStore } from '../../store/uiStore';
import { btn, cx, input } from '../common/ui';

type Props = { project: ProjectData };

/** Search box over the canvas: typing a name highlights the tables and seats where it sits. */
export function CanvasSearch({ project }: Props) {
  const query = useUiStore((s) => s.canvasSearch);
  const setQuery = useUiStore((s) => s.setCanvasSearch);
  const requestFocus = useUiStore((s) => s.requestFocus);
  const setSelection = useProjectStore((s) => s.setSelection);
  const result = useMemo(() => searchSeatedGuests(project, query), [project, query]);
  const derived = getDerived(project);
  const matchedTables = result ? project.tables.filter((table) => result.tableIds.has(table.id)) : [];

  return (
    <div className="absolute left-2 top-2 z-10 w-72 rounded-md bg-white/95 p-2 shadow">
      <div className="relative">
        <input
          type="text"
          className={cx(input, 'pr-8')}
          placeholder={t.canvasSearch.placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setQuery('');
              (e.target as HTMLInputElement).blur();
            }
          }}
          aria-label={t.canvasSearch.placeholder}
        />
        {query !== '' && (
          <button type="button" className="absolute inset-y-0 right-2 text-gray-500 hover:text-gray-800" onClick={() => setQuery('')} aria-label={t.canvasSearch.clear}>
            ×
          </button>
        )}
      </div>
      {result && (
        <div className="mt-1.5 text-xs text-gray-700">
          <div className="font-medium">{t.canvasSearch.summary(result.guestCount, matchedTables.length)}</div>
          {matchedTables.length > 0 && (
            <ul className="mt-1 flex max-h-40 flex-col gap-0.5 overflow-y-auto">
              {matchedTables.map((table) => {
                const seats = result.seatsByTable.get(table.id) ?? [];
                const names = seats.map((i) => derived.guestsById.get(table.seats[i].guestId as string)?.name ?? '').filter((n) => n !== '');
                return (
                  <li key={table.id}>
                    <button
                      type="button"
                      className={cx(btn.base, btn.ghost, btn.small, 'w-full justify-start text-left')}
                      onClick={() => {
                        setSelection([table.id]);
                        requestFocus({ type: 'table', id: table.id }, seats[0] ?? null);
                      }}
                    >
                      <span className="font-semibold">{table.label}</span>
                      <span className="truncate text-gray-600">· {names.join(', ')}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
