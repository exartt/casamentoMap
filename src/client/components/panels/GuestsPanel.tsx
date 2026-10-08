import { useVirtualizer } from '@tanstack/react-virtual';
import { useMemo, useRef, useState } from 'react';
import { matchesSearch } from '@shared/domain/text';
import type { Guest, ProjectData } from '@shared/domain/types';
import { t } from '../../i18n/strings';
import { deleteGuest } from '../../store/actions';
import { colorForGroup, getDerived } from '../../store/derived';
import { useProjectStore } from '../../store/projectStore';
import { useUiStore } from '../../store/uiStore';
import { GUEST_DRAG_TYPE } from '../canvas/PaletteTypes';
import { btn, cx, input, select } from '../common/ui';
import { GuestFormDialog } from '../dialogs/GuestFormDialog';

type Props = { project: ProjectData };

type Filter = 'all' | 'unseated' | 'seated';

const ROW_HEIGHT = 44;

/** Guest list with search, filters, counters, drag to the canvas and quick actions. */
export function GuestsPanel({ project }: Props) {
  const derived = getDerived(project);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [group, setGroup] = useState('');
  const [editing, setEditing] = useState<Guest | null | 'new'>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const setSelection = useProjectStore((s) => s.setSelection);
  const requestFocus = useUiStore((s) => s.requestFocus);
  const setDraggingGuestId = useUiStore((s) => s.setDraggingGuestId);

  const list = useMemo(() => {
    return derived.sortedGuests.filter((g) => {
      if (filter === 'unseated' && derived.seatMap.has(g.id)) return false;
      if (filter === 'seated' && !derived.seatMap.has(g.id)) return false;
      if (group !== '' && (g.group?.trim() ?? '') !== group) return false;
      return matchesSearch(g.name, query) || (g.group !== undefined && matchesSearch(g.group, query));
    });
  }, [derived, filter, group, query]);

  const virtualizer = useVirtualizer({
    count: list.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  const { counters } = derived;

  return (
    <div className="flex h-full flex-col gap-2">
      <input type="search" className={input} placeholder={t.guests.searchPlaceholder} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={t.guests.searchPlaceholder} />
      <div className="flex gap-1" role="group" aria-label="Filtro">
        {(
          [
            ['all', t.guests.filterAll],
            ['unseated', t.guests.filterUnseated],
            ['seated', t.guests.filterSeated],
          ] as Array<[Filter, string]>
        ).map(([value, text]) => (
          <button
            key={value}
            type="button"
            className={cx(btn.base, btn.small, filter === value ? btn.primary : btn.secondary, 'flex-1')}
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {text}
          </button>
        ))}
      </div>
      {derived.groups.length > 0 && (
        <select className={select} value={group} onChange={(e) => setGroup(e.target.value)} aria-label={t.guests.group}>
          <option value="">{t.guests.allGroups}</option>
          {derived.groups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      )}
      <div className="flex items-center justify-between text-xs text-gray-600">
        <span>{t.guests.counters(counters.guests, counters.seated, counters.unseated)}</span>
        <button type="button" className={cx(btn.base, btn.secondary, btn.small)} onClick={() => setEditing('new')}>
          + {t.guests.addGuest}
        </button>
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto rounded-md border border-gray-200 bg-white">
        {project.guests.length === 0 ? (
          <p className="p-3 text-xs text-gray-500">{t.guests.empty}</p>
        ) : list.length === 0 ? (
          <p className="p-3 text-xs text-gray-500">{t.guests.noResults}</p>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((row) => {
              const guest = list[row.index];
              const seat = derived.seatMap.get(guest.id);
              const table = seat ? derived.tablesById.get(seat.tableId) : undefined;
              const color = colorForGroup(derived, guest.group);
              return (
                <div
                  key={guest.id}
                  className="absolute left-0 top-0 flex w-full items-center gap-2 border-b border-gray-100 px-2"
                  style={{ height: row.size, transform: `translateY(${row.start}px)` }}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(GUEST_DRAG_TYPE, guest.id);
                    e.dataTransfer.effectAllowed = 'move';
                    setDraggingGuestId(guest.id);
                  }}
                  onDragEnd={() => setDraggingGuestId(null)}
                  title={t.guests.dragHint}
                >
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
                  <button
                    type="button"
                    className="min-w-0 flex-1 cursor-grab text-left active:cursor-grabbing"
                    onClick={() => {
                      if (seat && table) {
                        setSelection([table.id]);
                        requestFocus({ type: 'table', id: table.id }, seat.seatIndex);
                      }
                    }}
                  >
                    <span className="block truncate text-sm text-gray-900">
                      {guest.name}
                      {guest.isChild && <span className="ml-1 text-xs text-gray-500">({t.guests.child})</span>}
                    </span>
                    <span className={cx('block truncate text-xs', seat ? 'text-brand-700' : 'text-gray-500')}>
                      {seat && table ? t.guests.seatedAt(table.label, seat.seatIndex + 1) : t.guests.unseated}
                      {guest.group ? ` · ${guest.group}` : ''}
                    </span>
                  </button>
                  <button type="button" className={cx(btn.base, btn.ghost, btn.small)} onClick={() => setEditing(guest)} aria-label={t.guests.editGuest} title={t.guests.editGuest}>
                    ✎
                  </button>
                  <button type="button" className={cx(btn.base, btn.ghost, btn.small)} onClick={() => void deleteGuest(guest.id)} aria-label={t.app.remove} title={t.app.remove}>
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {editing !== null && <GuestFormDialog guest={editing === 'new' ? null : editing} groups={derived.groups} onClose={() => setEditing(null)} />}
    </div>
  );
}
