import type Konva from 'konva';
import { memo } from 'react';
import { Circle, Group, Rect, Text } from 'react-konva';
import type { ElementWarningLevel } from '@shared/domain/layoutValidation';
import type { Fixture } from '@shared/domain/types';
import { COLORS, contrastText, withAlpha } from './canvasUtils';
import type { DragHandlers } from './TableNode';

type Props = {
  fixture: Fixture;
  selected: boolean;
  warningLevel: ElementWarningLevel;
  interactive: boolean;
  dragOffset: { dx: number; dy: number } | null;
  registerNode: (id: string, node: Konva.Group | null) => void;
  onSelect: (id: string, e: Konva.KonvaEventObject<Event>) => void;
  drag: DragHandlers;
};

const LABEL_FONT_M = 0.28;

function strokeFor(level: ElementWarningLevel, selected: boolean, base: string): { color: string; width: number } {
  if (level === 'critical') return { color: COLORS.critical, width: 3 };
  if (level === 'error') return { color: COLORS.error, width: 3 };
  if (level === 'warning') return { color: COLORS.warning, width: 3 };
  if (selected) return { color: COLORS.selection, width: 3 };
  return { color: base, width: 1.5 };
}

/** Renders a fixture (rectangle or circle) with its label as a draggable, resizable Konva group. */
export const FixtureNode = memo(function FixtureNode(props: Props) {
  const { fixture, selected, warningLevel, interactive, dragOffset } = props;
  const stroke = strokeFor(warningLevel, selected, fixture.color);
  const x = fixture.x + (dragOffset ? dragOffset.dx : 0);
  const y = fixture.y + (dragOffset ? dragOffset.dy : 0);
  const fillAlpha = fixture.blocksPlacement ? 0.55 : 0.3;
  const textColor = contrastText(fixture.color);
  return (
    <Group
      id={fixture.id}
      name="fixture"
      x={x}
      y={y}
      rotation={fixture.rotation}
      draggable={interactive && !fixture.locked}
      ref={(node) => props.registerNode(fixture.id, node)}
      onClick={(e) => props.onSelect(fixture.id, e)}
      onTap={(e) => props.onSelect(fixture.id, e)}
      onDragStart={props.drag.onDragStart}
      onDragMove={props.drag.onDragMove}
      onDragEnd={props.drag.onDragEnd}
    >
      {fixture.shape === 'circle' ? (
        <Circle
          radius={fixture.widthM / 2}
          fill={withAlpha(fixture.color, fillAlpha)}
          stroke={stroke.color}
          strokeWidth={stroke.width}
          strokeScaleEnabled={false}
          dash={fixture.blocksPlacement ? undefined : [6, 4]}
        />
      ) : (
        <Rect
          x={-fixture.widthM / 2}
          y={-fixture.depthM / 2}
          width={fixture.widthM}
          height={fixture.depthM}
          fill={withAlpha(fixture.color, fillAlpha)}
          stroke={stroke.color}
          strokeWidth={stroke.width}
          strokeScaleEnabled={false}
          cornerRadius={0.08}
          dash={fixture.blocksPlacement ? undefined : [6, 4]}
        />
      )}
      <Text
        x={-fixture.widthM / 2}
        y={-fixture.depthM / 2}
        width={fixture.widthM}
        height={fixture.depthM}
        text={fixture.label}
        fontSize={Math.min(LABEL_FONT_M, fixture.widthM / 4)}
        fill={fillAlpha > 0.5 ? textColor : COLORS.text}
        align="center"
        verticalAlign="middle"
        listening={false}
        wrap="word"
      />
    </Group>
  );
});
