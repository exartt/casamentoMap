import { DOOR_SPECS, LIMITS } from '@shared/config/defaults';
import { wallLength } from '@shared/domain/geometry';
import type { Door, DoorKind, Venue, Wall } from '@shared/domain/types';
import { t } from '../../i18n/strings';
import { deleteElements, updateDoor } from '../../store/actions';
import { NumberField } from '../common/NumberField';
import { btn, cx, input, label, select } from '../common/ui';

type Props = { door: Door; venue: Venue };

const WALLS: Array<{ value: Wall; label: string }> = [
  { value: 'top', label: t.door.wallTop },
  { value: 'right', label: t.door.wallRight },
  { value: 'bottom', label: t.door.wallBottom },
  { value: 'left', label: t.door.wallLeft },
];

/** Properties of the selected door: name, type, wall, offset and width. */
export function DoorPanel({ door, venue }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <label className={label}>{t.door.name}</label>
          <input className={input} value={door.label} maxLength={LIMITS.maxLabelLength} onChange={(e) => updateDoor(door.id, { label: e.target.value }, `label:${door.id}`)} />
        </div>
        <div className="col-span-2">
          <label className={label}>{t.door.kind}</label>
          <select className={select} value={door.kind} onChange={(e) => updateDoor(door.id, { kind: e.target.value as DoorKind })}>
            {(Object.keys(DOOR_SPECS) as DoorKind[]).map((kind) => (
              <option key={kind} value={kind}>
                {DOOR_SPECS[kind].labelPt}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className={label}>{t.door.wall}</label>
          <select className={select} value={door.wall} onChange={(e) => updateDoor(door.id, { wall: e.target.value as Wall })}>
            {WALLS.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label}
              </option>
            ))}
          </select>
        </div>
        <NumberField label={t.door.offset} value={door.offsetM} min={0} max={wallLength(door.wall, venue)} step={0.1} suffix="m" onChange={(v) => updateDoor(door.id, { offsetM: v })} />
        <NumberField label={t.door.width} value={door.widthM} min={LIMITS.minElementM} max={10} step={0.1} suffix="m" onChange={(v) => updateDoor(door.id, { widthM: v })} />
      </div>
      <div>
        <button type="button" className={cx(btn.base, btn.danger, btn.small)} onClick={() => void deleteElements([door.id])}>
          {t.door.remove}
        </button>
      </div>
    </div>
  );
}
