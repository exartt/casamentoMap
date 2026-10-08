import { SEAT_SIZE_M } from '@shared/config/defaults';
import { seatSlots, tableFootprintSize } from '@shared/domain/geometry';
import type { Table } from '@shared/domain/types';
import { COLORS } from '../canvas/canvasUtils';
import { t } from '../../i18n/strings';

type Props = {
  table: Table;
  seatColors: Record<number, string>;
  onSeatClick: (seatIndex: number) => void;
};

const SIZE_PX = 180;

/** Small SVG of the table with numbered seats; clicking a seat focuses its combobox. */
export function TableMiniDiagram({ table, seatColors, onSeatClick }: Props) {
  const slots = seatSlots(table);
  const footprint = tableFootprintSize(table);
  const span = Math.max(footprint.width, footprint.height) + SEAT_SIZE_M;
  const scale = SIZE_PX / span;
  const cx = SIZE_PX / 2;
  const cy = SIZE_PX / 2;
  return (
    <svg width={SIZE_PX} height={SIZE_PX} viewBox={`0 0 ${SIZE_PX} ${SIZE_PX}`} role="img" aria-label={t.table.miniDiagram} className="mx-auto block">
      <rect
        x={cx - (table.widthM / 2) * scale}
        y={cy - (table.depthM / 2) * scale}
        width={table.widthM * scale}
        height={table.depthM * scale}
        rx={4}
        fill={table.highlight ? COLORS.tableHighlight : COLORS.tableEmpty}
        stroke={COLORS.tableStroke}
      />
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize={11} fill={COLORS.text}>
        {table.label}
      </text>
      {slots.map((slot) => {
        const size = SEAT_SIZE_M * scale;
        const x = cx + slot.localX * scale - size / 2;
        const y = cy + slot.localY * scale - size / 2;
        const fill = !slot.enabled ? COLORS.seatDisabled : seatColors[slot.index] ?? COLORS.seatFree;
        return (
          <g key={slot.index} className="cursor-pointer" onClick={() => onSeatClick(slot.index)}>
            <rect x={x} y={y} width={size} height={size} rx={3} fill={fill} stroke={COLORS.seatStroke} strokeDasharray={slot.enabled ? undefined : '3 2'} opacity={slot.enabled ? 1 : 0.6} />
            <text x={x + size / 2} y={y + size / 2 + 3.5} textAnchor="middle" fontSize={9} fill={seatColors[slot.index] ? '#ffffff' : COLORS.text}>
              {slot.index + 1}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
