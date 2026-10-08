import type Konva from 'konva';
import { memo } from 'react';
import { Group, Line, Rect, Text } from 'react-konva';
import { DOOR_SPECS, WALL_THICKNESS_M } from '@shared/config/defaults';
import { doorCenter, wallRotation } from '@shared/domain/geometry';
import type { Door, Venue } from '@shared/domain/types';
import { COLORS, withAlpha } from './canvasUtils';

type DoorProps = {
  door: Door;
  venue: Venue;
  selected: boolean;
  interactive: boolean;
  registerNode: (id: string, node: Konva.Group | null) => void;
  onSelect: (id: string, e: Konva.KonvaEventObject<Event>) => void;
  onDragStart: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void;
};

const LEAF_THICKNESS_M = WALL_THICKNESS_M * 2.2;

const LABEL_FONT_M = 0.22;

/** Renders the door leaf on the wall; dragging slides it along the walls. */
export const DoorNode = memo(function DoorNode(props: DoorProps) {
  const { door, venue, selected, interactive } = props;
  const center = doorCenter(door, venue);
  const spec = DOOR_SPECS[door.kind];
  return (
    <Group
      id={door.id}
      name="door"
      x={center.x}
      y={center.y}
      rotation={wallRotation(door.wall)}
      draggable={interactive}
      ref={(node) => props.registerNode(door.id, node)}
      onClick={(e) => props.onSelect(door.id, e)}
      onTap={(e) => props.onSelect(door.id, e)}
      onDragStart={props.onDragStart}
      onDragMove={props.onDragMove}
      onDragEnd={props.onDragEnd}
    >
      <Rect
        x={-door.widthM / 2}
        y={-LEAF_THICKNESS_M / 2}
        width={door.widthM}
        height={LEAF_THICKNESS_M}
        fill={spec.color}
        stroke={selected ? COLORS.selection : '#ffffff'}
        strokeWidth={selected ? 3 : 1}
        strokeScaleEnabled={false}
        cornerRadius={0.03}
      />
      <Line
        points={[-door.widthM / 2, LEAF_THICKNESS_M / 2, -door.widthM / 2, LEAF_THICKNESS_M / 2 + door.widthM * 0.9]}
        stroke={spec.color}
        strokeWidth={1.5}
        strokeScaleEnabled={false}
        listening={false}
      />
      <Line
        points={[-door.widthM / 2, LEAF_THICKNESS_M / 2 + door.widthM * 0.9, door.widthM / 2, LEAF_THICKNESS_M / 2]}
        stroke={spec.color}
        strokeWidth={1}
        strokeScaleEnabled={false}
        dash={[4, 4]}
        listening={false}
      />
      <Text
        x={-door.widthM / 2}
        y={-LEAF_THICKNESS_M / 2 - LABEL_FONT_M * 1.4}
        width={door.widthM}
        height={LABEL_FONT_M * 1.3}
        text={spec.shortLabel}
        fontSize={LABEL_FONT_M}
        fontStyle="bold"
        fill={spec.color}
        align="center"
        verticalAlign="middle"
        listening={false}
      />
    </Group>
  );
});

type ClearanceProps = {
  door: Door;
  venue: Venue;
  clearanceM: number;
};

const HATCH_STEP_M = 0.25;

/** Draws the hatched clearance area in front of a door, in the background layer. */
export const DoorClearance = memo(function DoorClearance({ door, venue, clearanceM }: ClearanceProps) {
  const center = doorCenter(door, venue);
  const spec = DOOR_SPECS[door.kind];
  const w = door.widthM;
  const lines: JSX.Element[] = [];
  for (let d = -clearanceM; d < w + clearanceM; d += HATCH_STEP_M) {
    lines.push(
      <Line
        key={d}
        points={[-w / 2 + d, 0, -w / 2 + d + clearanceM, clearanceM]}
        stroke={withAlpha(spec.color, 0.35)}
        strokeWidth={1}
        strokeScaleEnabled={false}
        listening={false}
      />,
    );
  }
  return (
    <Group x={center.x} y={center.y} rotation={wallRotation(door.wall)} listening={false}>
      <Group
        clipFunc={(ctx) => {
          ctx.rect(-w / 2, 0, w, clearanceM);
        }}
      >
        <Rect x={-w / 2} y={0} width={w} height={clearanceM} fill={withAlpha(spec.color, 0.06)} />
        {lines}
      </Group>
      <Rect
        x={-w / 2}
        y={0}
        width={w}
        height={clearanceM}
        stroke={withAlpha(spec.color, 0.5)}
        strokeWidth={1}
        strokeScaleEnabled={false}
        dash={[4, 3]}
      />
      <Text
        x={-w / 2}
        y={clearanceM + 0.05}
        width={w}
        text={door.label}
        fontSize={0.2}
        fill={spec.color}
        align="center"
        listening={false}
      />
    </Group>
  );
});
