import { useEffect, useMemo, useRef, useState } from 'react';
import { LIMITS, TABLE_SPECS } from '@shared/config/defaults';
import { tableOccupancy } from '@shared/domain/seating';
import { compareNames } from '@shared/domain/text';
import type { Guest, ProjectData, Table, TableKind } from '@shared/domain/types';
import { t } from '../../i18n/strings';
import { deleteElements, duplicateElements, emptyTableGuests, seatGuest, swapSeatOccupants, toggleSeat, unseatGuest, updateTable } from '../../store/actions';
import { colorForGroup, getDerived } from '../../store/derived';
import { useUiStore } from '../../store/uiStore';
import { NumberField } from '../common/NumberField';
import { btn, checkbox, cx, input, label, select } from '../common/ui';
import { MoveGuestDialog } from '../dialogs/MoveGuestDialog';
import { GuestCombobox } from './GuestCombobox';
import { TableMiniDiagram } from './TableMiniDiagram';

type Props = { table: Table; project: ProjectData };

const SEAT_DRAG_TYPE = 'application/x-seat';

/** Properties of the selected table: fields, seat list with comboboxes, mini diagram, actions and summary. */
export function TablePanel({ table, project }: Props) {
  const derived = getDerived(project);
  const occupancy = tableOccupancy(table);
  const seatInputs = useRef(new Map<number, HTMLInputElement>());
  const focusRequest = useUiStore((s) => s.focusRequest);
  const [moveOpen, setMoveOpen] = useState(false);
  const [dragOverSeat, setDragOverSeat] = useState<number | null>(null);

  const unseated = useMemo(
    () => project.guests.filter((g) => !derived.seatMap.has(g.id)).sort((a, b) => compareNames(a.name, b.name)),
    [project.guests, derived.seatMap],
  );

  useEffect(() => {
    if (!focusRequest || focusRequest.ref.id !== table.id || focusRequest.seatIndex === null) return;
    const el = seatInputs.current.get(focusRequest.seatIndex);
    el?.focus();
    el?.scrollIntoView({ block: 'nearest' });
  }, [focusRequest, table.id]);

  const seatColors = useMemo(() => {
    const colors: Record<number, string> = {};
    for (const seat of table.seats) {
      if (!seat.guestId) continue;
      colors[seat.index] = colorForGroup(derived, derived.guestsById.get(seat.guestId)?.group);
    }
    return colors;
  }, [table, derived]);

  const summary = useMemo(() => {
    const groups = new Map<string, number>();
    let children = 0;
    const dietary: string[] = [];
    for (const seat of table.seats) {
      if (!seat.guestId) continue;
      const g = derived.guestsById.get(seat.guestId);
      if (!g) continue;
      const group = g.group?.trim() || t.guests.noGroup;
      groups.set(group, (groups.get(group) ?? 0) + 1);
      if (g.isChild) children += 1;
      if (g.dietary?.trim()) dietary.push(`${g.name}: ${g.dietary.trim()}`);
    }
    return { groups: [...groups.entries()], children, dietary };
  }, [table, derived]);

  const spec = TABLE_SPECS[table.kind];

  const onSeatDrop = (targetIndex: number, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverSeat(null);
    const raw = e.dataTransfer.getData(SEAT_DRAG_TYPE);
    if (!raw) return;
    let from: { tableId: string; seatIndex: number };
    try {
      from = JSON.parse(raw) as { tableId: string; seatIndex: number };
    } catch {
      return;
    }
    if (from.tableId === table.id && from.seatIndex === targetIndex) return;
    if (!table.seats[targetIndex].enabled) return;
    swapSeatOccupants(from, { tableId: table.id, seatIndex: targetIndex });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <label className={label}>{t.table.name}</label>
          <input
            className={input}
            value={table.label}
            maxLength={LIMITS.maxLabelLength}
            onChange={(e) => updateTable(table.id, { label: e.target.value }, `label:${table.id}`)}
          />
        </div>
        <div className="col-span-2">
          <label className={label}>{t.table.kind}</label>
          <select className={select} value={table.kind} onChange={(e) => updateTable(table.id, { kind: e.target.value as TableKind })}>
            {(Object.keys(TABLE_SPECS) as TableKind[]).map((kind) => (
              <option key={kind} value={kind}>
                {TABLE_SPECS[kind].labelPt} ({TABLE_SPECS[kind].capacity} lugares)
              </option>
            ))}
          </select>
        </div>
        <NumberField label={t.table.width} value={table.widthM} min={LIMITS.minElementM} max={LIMITS.maxElementM} step={0.1} suffix="m" onChange={(v) => updateTable(table.id, { widthM: v })} />
        <NumberField label={t.table.depth} value={table.depthM} min={LIMITS.minElementM} max={LIMITS.maxElementM} step={0.1} suffix="m" onChange={(v) => updateTable(table.id, { depthM: v })} />
        <NumberField label={t.table.rotation} value={table.rotation} decimals={0} step={15} suffix="°" onChange={(v) => updateTable(table.id, { rotation: v })} />
        <div />
        <NumberField label={t.table.x} value={table.x} step={0.1} suffix="m" onChange={(v) => updateTable(table.id, { x: v })} />
        <NumberField label={t.table.y} value={table.y} step={0.1} suffix="m" onChange={(v) => updateTable(table.id, { y: v })} />
        <label className="col-span-2 flex items-center gap-2 text-sm">
          <input type="checkbox" className={checkbox} checked={table.highlight} onChange={(e) => updateTable(table.id, { highlight: e.target.checked })} />
          {t.table.highlight}
        </label>
        <label className="col-span-2 flex items-center gap-2 text-sm">
          <input type="checkbox" className={checkbox} checked={table.locked} onChange={(e) => updateTable(table.id, { locked: e.target.checked })} />
          {t.table.locked}
        </label>
        <div className="col-span-2">
          <label className={label}>{t.table.notes}</label>
          <textarea
            className={cx(input, 'min-h-[3rem]')}
            value={table.notes ?? ''}
            maxLength={LIMITS.maxNotesLength}
            onChange={(e) => updateTable(table.id, { notes: e.target.value }, `notes:${table.id}`)}
          />
        </div>
      </div>

      <div>
        <TableMiniDiagram
          table={table}
          seatColors={seatColors}
          onSeatClick={(i) => {
            const el = seatInputs.current.get(i);
            el?.focus();
            el?.scrollIntoView({ block: 'nearest' });
          }}
        />
        <p className="text-center text-xs text-gray-500">{t.table.miniDiagram}</p>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">
            {t.table.seats} · {t.table.occupancy(occupancy.occupied, occupancy.enabled)}
          </h3>
          <span className="text-xs text-gray-500">{spec.capacity} máx.</span>
        </div>
        <p className="mb-2 text-xs text-gray-500">{t.table.swapHint}</p>
        <ul className="flex flex-col gap-1.5">
          {table.seats.map((seat) => {
            const occupant = seat.guestId ? derived.guestsById.get(seat.guestId) ?? null : null;
            const options = occupant ? [occupant, ...unseated] : unseated;
            return (
              <li
                key={seat.index}
                className={cx(
                  'flex items-center gap-1.5 rounded-md border px-1.5 py-1',
                  dragOverSeat === seat.index ? 'border-brand-500 bg-brand-50' : 'border-transparent',
                  !seat.enabled && 'opacity-60',
                )}
                draggable={occupant !== null}
                onDragStart={(e) => {
                  e.dataTransfer.setData(SEAT_DRAG_TYPE, JSON.stringify({ tableId: table.id, seatIndex: seat.index }));
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes(SEAT_DRAG_TYPE) && seat.enabled) {
                    e.preventDefault();
                    setDragOverSeat(seat.index);
                  }
                }}
                onDragLeave={() => setDragOverSeat(null)}
                onDrop={(e) => onSeatDrop(seat.index, e)}
              >
                <span className="w-5 shrink-0 text-right text-xs tabular-nums text-gray-500" style={{ color: seatColors[seat.index] }}>
                  {seat.index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  {seat.enabled ? (
                    <GuestCombobox
                      ref={(el) => {
                        if (el) seatInputs.current.set(seat.index, el);
                        else seatInputs.current.delete(seat.index);
                      }}
                      guests={options}
                      value={occupant}
                      ariaLabel={t.table.seat(seat.index + 1)}
                      compact
                      onChange={(g: Guest | null) => {
                        if (g) void seatGuest(g.id, table.id, seat.index);
                        else if (occupant) unseatGuest(occupant.id);
                      }}
                    />
                  ) : (
                    <span className="block px-2 text-xs italic text-gray-500">{t.table.seatDisabled}</span>
                  )}
                </div>
                {occupant && seat.enabled && (
                  <button type="button" className={cx(btn.base, btn.ghost, btn.small)} onClick={() => unseatGuest(occupant.id)} aria-label={t.table.removeGuest} title={t.table.removeGuest}>
                    ×
                  </button>
                )}
                <button
                  type="button"
                  className={cx(btn.base, btn.ghost, btn.small)}
                  onClick={() => void toggleSeat(table.id, seat.index, !seat.enabled)}
                  aria-label={seat.enabled ? t.table.disableSeat : t.table.enableSeat}
                  title={seat.enabled ? t.table.disableSeat : t.table.enableSeat}
                >
                  {seat.enabled ? '⊘' : '✓'}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-col gap-2">
        <div>
          <label className={label}>{t.table.addToNextFree}</label>
          <GuestCombobox
            guests={unseated}
            value={null}
            ariaLabel={t.table.addToNextFree}
            disabled={occupancy.free === 0}
            onChange={(g) => {
              if (g) void seatGuest(g.id, table.id, null);
            }}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={cx(btn.base, btn.secondary, btn.small)} onClick={() => setMoveOpen(true)} disabled={occupancy.occupied === 0}>
            {t.table.moveGuest}
          </button>
          <button type="button" className={cx(btn.base, btn.secondary, btn.small)} onClick={() => void emptyTableGuests(table.id)} disabled={occupancy.occupied === 0}>
            {t.table.emptyTable}
          </button>
          <button type="button" className={cx(btn.base, btn.secondary, btn.small)} onClick={() => duplicateElements([table.id])}>
            {t.table.duplicate}
          </button>
          <button type="button" className={cx(btn.base, btn.danger, btn.small)} onClick={() => void deleteElements([table.id])}>
            {t.table.remove}
          </button>
        </div>
      </div>

      <div className="rounded-md bg-gray-50 p-2 text-xs text-gray-700">
        <h3 className="mb-1 font-semibold">{t.table.summary}</h3>
        {occupancy.occupied === 0 ? (
          <p>{t.table.noSummary}</p>
        ) : (
          <>
            <p>
              {t.table.groups}: {summary.groups.map(([g, n]) => `${g} (${n})`).join(', ')}
            </p>
            <p>{t.table.childrenCount(summary.children)}</p>
            {summary.dietary.length > 0 && (
              <p>
                {t.table.dietaryList}: {summary.dietary.join('; ')}
              </p>
            )}
          </>
        )}
      </div>

      {moveOpen && <MoveGuestDialog table={table} project={project} onClose={() => setMoveOpen(false)} />}
    </div>
  );
}
