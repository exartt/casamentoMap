import { useEffect, useMemo, useRef, useState } from 'react';
import { ZOOM_MAX, ZOOM_MIN } from '@shared/config/defaults';
import { tableOccupancy } from '@shared/domain/seating';
import { compareNames, matchesSearch } from '@shared/domain/text';
import type { ProjectData } from '@shared/domain/types';
import { t } from '../../i18n/strings';
import { colorForGroup, getDerived } from '../../store/derived';
import { useUiStore } from '../../store/uiStore';
import { CanvasStage } from '../canvas/CanvasStage';
import { zoomAround } from '../canvas/canvasUtils';
import { btn, cx, input } from '../common/ui';

type Props = {
  project: ProjectData;
  subtitle?: string;
  note?: string;
  onExit?: () => void;
};

const MAX_RESULTS = 40;

const ZOOM_STEP = 1.25;

const NARROW_QUERY = '(max-width: 639px)';

const ANCHOR_WITH_SHEET = { x: 0.5, y: 0.25 };

const ANCHOR_CENTER = { x: 0.5, y: 0.5 };

/** Tracks whether the viewport is phone-sized, where the table sheet covers the lower part of the plan. */
function useNarrowScreen(): boolean {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia(NARROW_QUERY).matches);
  useEffect(() => {
    const media = window.matchMedia(NARROW_QUERY);
    const onChange = () => setNarrow(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return narrow;
}

/** Uncluttered read-only view for the event day: the plan, who sits where and a search box. */
export function EventDayView({ project, subtitle, note, onExit }: Props) {
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState<{ tableId: string; seatIndex: number | null } | null>(null);
  const [openTableId, setOpenTableId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestFocus = useUiStore((s) => s.requestFocus);
  const requestFit = useUiStore((s) => s.requestFit);
  const setViewport = useUiStore((s) => s.setViewport);
  const viewport = useUiStore((s) => s.viewport);
  const narrow = useNarrowScreen();

  const derived = getDerived(project);
  const counters = derived.counters;

  const results = useMemo(() => {
    if (query.trim() === '') return [];
    return project.guests
      .filter((g) => matchesSearch(g.name, query))
      .sort((a, b) => compareNames(a.name, b.name))
      .slice(0, MAX_RESULTS);
  }, [project.guests, query]);

  useEffect(() => {
    inputRef.current?.focus();
    const timer = setTimeout(() => requestFit(), 50);
    return () => clearTimeout(timer);
  }, [requestFit]);

  useEffect(() => {
    if (!onExit) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && query === '' && openTableId === null) onExit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onExit, query, openTableId]);

  const openTable = openTableId ? derived.tablesById.get(openTableId) : undefined;

  const zoomAtCenter = (vp: typeof viewport, factor: number) => {
    const size = useUiStore.getState().stageSize;
    return zoomAround(vp, { x: size.width / 2, y: size.height / 2 }, Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, vp.zoom * factor)));
  };

  const goToGuest = (guestId: string) => {
    const loc = derived.seatMap.get(guestId);
    if (!loc) return;
    setHighlight({ tableId: loc.tableId, seatIndex: loc.seatIndex });
    requestFocus({ type: 'table', id: loc.tableId }, loc.seatIndex);
    setOpenTableId(loc.tableId);
  };

  return (
    <div className="flex h-screen flex-col bg-gray-100">
      <header className="border-b border-gray-200 bg-white px-3 py-2 sm:px-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-gray-900">{project.name}</h1>
            <p className="truncate text-xs text-gray-500">
              {subtitle ? `${subtitle} · ` : ''}
              {t.eventMode.tables(project.tables.length)} · {t.eventMode.seated(counters.seated, counters.guests)}
            </p>
          </div>
          {onExit && (
            <button type="button" className={cx(btn.base, btn.secondary, 'shrink-0')} onClick={onExit}>
              {t.eventMode.exit}
            </button>
          )}
        </div>
        <div className="relative mt-2">
          <input
            ref={inputRef}
            type="text"
            className={cx(input, 'py-2.5 pr-9 text-base')}
            placeholder={t.eventMode.searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setQuery('');
              if (e.key === 'Enter' && results.length > 0) goToGuest(results[0].id);
            }}
            aria-label={t.eventMode.searchPlaceholder}
            autoComplete="off"
          />
          {query !== '' && (
            <button type="button" className="absolute inset-y-0 right-3 text-lg text-gray-500 hover:text-gray-800" onClick={() => setQuery('')} aria-label={t.canvasSearch.clear}>
              ×
            </button>
          )}
        </div>
        {query.trim() !== '' && (
          <ul className="mt-1 max-h-56 overflow-y-auto rounded-md border border-gray-200 bg-white text-sm shadow-sm">
            {results.length === 0 && <li className="px-3 py-2 text-gray-500">{t.eventMode.noResults}</li>}
            {results.map((g) => {
              const loc = derived.seatMap.get(g.id);
              const table = loc ? derived.tablesById.get(loc.tableId) : undefined;
              return (
                <li key={g.id}>
                  <button type="button" className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-brand-50" onClick={() => goToGuest(g.id)} disabled={!loc}>
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: colorForGroup(derived, g.group) }} aria-hidden="true" />
                      <span className="truncate">{g.name}</span>
                    </span>
                    <span className={cx('shrink-0 text-xs font-medium', loc ? 'text-brand-700' : 'text-gray-400')}>
                      {loc && table ? t.eventMode.seatedAt(table.label, loc.seatIndex + 1) : t.eventMode.unseated}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </header>

      <div className="relative min-h-0 flex-1">
        <CanvasStage
          project={project}
          readOnly
          minimal
          highlightQuery={query}
          externalHighlight={highlight}
          onTableTap={(id) => setOpenTableId(id)}
          focusAnchor={narrow && openTableId !== null ? ANCHOR_WITH_SHEET : ANCHOR_CENTER}
        />
        <div className="absolute right-2 top-2 flex flex-col items-end gap-1.5">
          <button type="button" className={cx(btn.base, btn.primary, 'h-11 px-3 text-sm shadow-md')} onClick={requestFit}>
            ⤢ {t.eventMode.center}
          </button>
          <button type="button" className={cx(btn.base, btn.secondary, 'h-11 w-11 p-0 text-lg shadow')} onClick={() => setViewport(zoomAtCenter(viewport, ZOOM_STEP))} aria-label={t.eventMode.zoomIn}>
            +
          </button>
          <button type="button" className={cx(btn.base, btn.secondary, 'h-11 w-11 p-0 text-lg shadow')} onClick={() => setViewport(zoomAtCenter(viewport, 1 / ZOOM_STEP))} aria-label={t.eventMode.zoomOut}>
            −
          </button>
        </div>
        {openTable && (
          <div className="absolute inset-x-0 bottom-0 max-h-[55%] overflow-y-auto rounded-t-lg border-t border-gray-200 bg-white p-3 shadow-lg sm:inset-x-auto sm:right-2 sm:bottom-2 sm:w-80 sm:rounded-lg sm:border">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">
                {openTable.label} <span className="text-xs font-normal text-gray-500">{tableOccupancy(openTable).occupied}/{tableOccupancy(openTable).enabled}</span>
              </h2>
              <button type="button" className={cx(btn.base, btn.ghost, 'h-9 w-9 p-0 text-lg')} onClick={() => setOpenTableId(null)} aria-label={t.app.close}>
                ×
              </button>
            </div>
            <ol className="text-sm">
              {openTable.seats.map((seat) => {
                if (!seat.enabled) return null;
                const guest = seat.guestId ? derived.guestsById.get(seat.guestId) : undefined;
                const marked = highlight !== null && highlight.tableId === openTable.id && highlight.seatIndex === seat.index;
                return (
                  <li key={seat.index} className={cx('flex items-center gap-2 rounded px-1 py-0.5', marked && 'bg-pink-100 font-semibold')}>
                    <span className="w-5 text-right text-xs tabular-nums text-gray-500">{seat.index + 1}.</span>
                    {guest ? (
                      <>
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: colorForGroup(derived, guest.group) }} aria-hidden="true" />
                        <span className="truncate">{guest.name}</span>
                      </>
                    ) : (
                      <span className="text-gray-400">{t.print.emptySeat}</span>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </div>
      <p className="bg-white px-3 py-1 text-center text-xs text-gray-500">{note ?? t.eventMode.hint}</p>
    </div>
  );
}
