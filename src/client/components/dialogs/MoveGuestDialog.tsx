import { useMemo, useState } from 'react';
import { tableOccupancy } from '@shared/domain/seating';
import { compareNames } from '@shared/domain/text';
import type { ProjectData, Table } from '@shared/domain/types';
import { t } from '../../i18n/strings';
import { seatGuest } from '../../store/actions';
import { getDerived } from '../../store/derived';
import { btn, cx, label, select } from '../common/ui';
import { Modal } from './Modal';

type Props = { table: Table; project: ProjectData; onClose: () => void };

/** Moves a guest of the current table to the first free seat of another table. */
export function MoveGuestDialog({ table, project, onClose }: Props) {
  const derived = getDerived(project);
  const guests = useMemo(
    () =>
      table.seats
        .filter((s) => s.guestId)
        .map((s) => derived.guestsById.get(s.guestId as string))
        .filter((g): g is NonNullable<typeof g> => g !== undefined)
        .sort((a, b) => compareNames(a.name, b.name)),
    [table, derived],
  );
  const targets = useMemo(() => project.tables.filter((x) => x.id !== table.id && tableOccupancy(x).free > 0), [project.tables, table.id]);
  const [guestId, setGuestId] = useState(guests[0]?.id ?? '');
  const [targetId, setTargetId] = useState(targets[0]?.id ?? '');

  const submit = async () => {
    if (!guestId || !targetId) return;
    const ok = await seatGuest(guestId, targetId, null);
    if (ok) onClose();
  };

  return (
    <Modal
      title={t.table.moveGuest}
      open
      onClose={onClose}
      size="sm"
      footer={
        <>
          <button type="button" className={cx(btn.base, btn.secondary)} onClick={onClose}>
            {t.app.cancel}
          </button>
          <button type="button" className={cx(btn.base, btn.primary)} onClick={() => void submit()} disabled={!guestId || !targetId}>
            {t.table.moveGuest}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div>
          <label className={label}>{t.panels.guests}</label>
          <select className={select} value={guestId} onChange={(e) => setGuestId(e.target.value)}>
            {guests.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>{t.print.table}</label>
          <select className={select} value={targetId} onChange={(e) => setTargetId(e.target.value)}>
            {targets.map((x) => {
              const occ = tableOccupancy(x);
              return (
                <option key={x.id} value={x.id}>
                  {x.label} · {occ.free} livre(s)
                </option>
              );
            })}
          </select>
          {targets.length === 0 && <p className="mt-1 text-xs text-red-700">{t.table.full}</p>}
        </div>
      </div>
    </Modal>
  );
}
