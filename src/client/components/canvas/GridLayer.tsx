import { memo } from 'react';
import { Group, Line, Rect } from 'react-konva';
import { WALL_THICKNESS_M } from '@shared/config/defaults';
import type { Venue } from '@shared/domain/types';
import { COLORS } from './canvasUtils';

type Props = {
  venue: Venue;
  showGrid: boolean;
  showMinor: boolean;
};

const MAJOR_STEP_M = 1;

const MINOR_STEP_M = 0.5;

/** Draws the venue floor, walls and the metric grid. */
export const GridLayer = memo(function GridLayer({ venue, showGrid, showMinor }: Props) {
  const lines: JSX.Element[] = [];
  if (showGrid) {
    const step = showMinor ? MINOR_STEP_M : MAJOR_STEP_M;
    for (let x = step; x < venue.widthM; x += step) {
      const major = Math.abs(x / MAJOR_STEP_M - Math.round(x / MAJOR_STEP_M)) < 1e-9;
      lines.push(
        <Line
          key={`v${x}`}
          points={[x, 0, x, venue.depthM]}
          stroke={major ? COLORS.grid : COLORS.gridMinor}
          strokeWidth={major ? 1 : 0.6}
          strokeScaleEnabled={false}
          listening={false}
        />,
      );
    }
    for (let y = step; y < venue.depthM; y += step) {
      const major = Math.abs(y / MAJOR_STEP_M - Math.round(y / MAJOR_STEP_M)) < 1e-9;
      lines.push(
        <Line
          key={`h${y}`}
          points={[0, y, venue.widthM, y]}
          stroke={major ? COLORS.grid : COLORS.gridMinor}
          strokeWidth={major ? 1 : 0.6}
          strokeScaleEnabled={false}
          listening={false}
        />,
      );
    }
  }
  return (
    <Group listening={false}>
      <Rect
        x={-WALL_THICKNESS_M}
        y={-WALL_THICKNESS_M}
        width={venue.widthM + WALL_THICKNESS_M * 2}
        height={venue.depthM + WALL_THICKNESS_M * 2}
        fill={COLORS.wall}
        cornerRadius={0.05}
      />
      <Rect x={0} y={0} width={venue.widthM} height={venue.depthM} fill={COLORS.floor} name="floor" />
      {lines}
    </Group>
  );
});
