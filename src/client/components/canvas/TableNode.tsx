import type Konva from 'konva';
import { memo, useMemo } from 'react';
import { Group, Rect, Text } from 'react-konva';
import { SEAT_SIZE_M } from '@shared/config/defaults';
import { seatSlots } from '@shared/domain/geometry';
import type { ElementWarningLevel } from '@shared/domain/layoutValidation';
import { tableOccupancy } from '@shared/domain/seating';
import type { Table } from '@shared/domain/types';
import { COLORS, tableFillColor } from './canvasUtils';

export type SeatColors = Record<number, string>;

export type SearchState = 'none' | 'match' | 'dim';

export type DragHandlers = {
  onDragStart: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void;
};

type Props = {
  table: Table;
  selected: boolean;
  warningLevel: ElementWarningLevel;
  seatColors: SeatColors;
  dropSeatIndex: number | null;
  dropTable: boolean;
  dropRefused: boolean;
  flash: boolean;
  searchState: SearchState;
  matchedSeats: number[] | null;
  highlightSeat: number | null;
  interactive: boolean;
  dragOffset: { dx: number; dy: number } | null;
  registerNode: (id: string, node: Konva.Group | null) => void;
  onSelect: (id: string, e: Konva.KonvaEventObject<Event>) => void;
  onSeatClick: (tableId: string, seatIndex: number, e: Konva.KonvaEventObject<Event>) => void;
  onHover: (id: string | null) => void;
  drag: DragHandlers;
};

const LABEL_FONT_M = 0.26;

const SUB_FONT_M = 0.22;

const STROKE_SELECTED_PX = 3;

const STROKE_PX = 1.5;

const DIM_OPACITY = 0.3;

function strokeFor(level: ElementWarningLevel, selected: boolean, flash: boolean, dropTable: boolean, searchState: SearchState): { color: string; width: number } {
  if (flash) return { color: COLORS.dropRefused, width: 4 };
  if (searchState === 'match') return { color: COLORS.searchMatch, width: 4 };
  if (dropTable) return { color: COLORS.dropTarget, width: 4 };
  if (level === 'critical') return { color: COLORS.critical, width: 3 };
  if (level === 'error') return { color: COLORS.error, width: 3 };
  if (level === 'warning') return { color: COLORS.warning, width: 3 };
  if (selected) return { color: COLORS.selection, width: STROKE_SELECTED_PX };
  return { color: COLORS.tableStroke, width: STROKE_PX };
}

/** Renders a table with its seats and label as one draggable Konva group. */
export const TableNode = memo(function TableNode(props: Props) {
  const { table, selected, warningLevel, seatColors, dropSeatIndex, dropTable, dropRefused, flash, highlightSeat, interactive, dragOffset, searchState, matchedSeats } = props;
  const slots = useMemo(() => seatSlots(table), [table]);
  const occupancy = tableOccupancy(table);
  const stroke = strokeFor(warningLevel, selected, flash, dropTable && !dropRefused, searchState);
  const fill = tableFillColor(table);
  const x = table.x + (dragOffset ? dragOffset.dx : 0);
  const y = table.y + (dragOffset ? dragOffset.dy : 0);
  return (
    <Group
      id={table.id}
      name="table"
      x={x}
      y={y}
      rotation={table.rotation}
      opacity={searchState === 'dim' ? DIM_OPACITY : 1}
      draggable={interactive && !table.locked}
      ref={(node) => props.registerNode(table.id, node)}
      onClick={(e) => props.onSelect(table.id, e)}
      onTap={(e) => props.onSelect(table.id, e)}
      onMouseEnter={() => props.onHover(table.id)}
      onMouseLeave={() => props.onHover(null)}
      onDragStart={props.drag.onDragStart}
      onDragMove={props.drag.onDragMove}
      onDragEnd={props.drag.onDragEnd}
    >
      {slots.map((slot) => {
        const isDrop = dropSeatIndex === slot.index;
        const isHighlight = highlightSeat === slot.index || (matchedSeats !== null && matchedSeats.includes(slot.index));
        const color = seatColors[slot.index];
        return (
          <Rect
            key={slot.index}
            name="seat"
            x={slot.localX - SEAT_SIZE_M / 2}
            y={slot.localY - SEAT_SIZE_M / 2}
            width={SEAT_SIZE_M}
            height={SEAT_SIZE_M}
            cornerRadius={0.1}
            fill={!slot.enabled ? COLORS.seatDisabled : color ?? COLORS.seatFree}
            opacity={slot.enabled ? 1 : 0.5}
            stroke={isDrop ? (dropRefused ? COLORS.dropRefused : COLORS.dropTarget) : isHighlight ? COLORS.searchMatch : COLORS.seatStroke}
            strokeWidth={isDrop || isHighlight ? 3 : 1}
            strokeScaleEnabled={false}
            dash={slot.enabled ? undefined : [4, 3]}
            onClick={(e) => props.onSeatClick(table.id, slot.index, e)}
            onTap={(e) => props.onSeatClick(table.id, slot.index, e)}
          />
        );
      })}
      <Rect
        name="top"
        x={-table.widthM / 2}
        y={-table.depthM / 2}
        width={table.widthM}
        height={table.depthM}
        fill={fill}
        stroke={stroke.color}
        strokeWidth={stroke.width}
        strokeScaleEnabled={false}
        cornerRadius={0.06}
        shadowColor={searchState === 'match' ? COLORS.searchMatch : table.highlight ? COLORS.tableHighlightStroke : undefined}
        shadowBlur={searchState === 'match' ? 0.5 : table.highlight ? 0.2 : 0}
        shadowOpacity={searchState === 'match' ? 0.9 : table.highlight ? 0.6 : 0}
      />
      <Text
        x={-table.widthM / 2}
        y={-table.depthM / 2}
        width={table.widthM}
        height={table.depthM}
        text={`${table.label}\n${occupancy.occupied}/${occupancy.enabled}`}
        fontSize={table.widthM < 1.2 ? SUB_FONT_M : LABEL_FONT_M}
        fontStyle={table.highlight ? 'bold' : 'normal'}
        fill={COLORS.text}
        align="center"
        verticalAlign="middle"
        lineHeight={1.2}
        listening={false}
        rotation={table.rotation > 90 && table.rotation < 270 ? 180 : 0}
        offsetX={table.rotation > 90 && table.rotation < 270 ? table.widthM : 0}
        offsetY={table.rotation > 90 && table.rotation < 270 ? table.depthM : 0}
      />
    </Group>
  );
});
