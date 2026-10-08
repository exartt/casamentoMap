import { memo } from 'react';
import { Group, Line, Rect, Text } from 'react-konva';
import { formatMeters } from '@shared/domain/text';
import type { Venue } from '@shared/domain/types';
import { useUiStore } from '../../store/uiStore';
import { COLORS, withAlpha } from './canvasUtils';

type Props = { venue: Venue };

const LABEL_FONT_M = 0.24;

/** Shows the distance to the nearest walls while dragging and the rubber-band selection rectangle. */
export const DragOverlay = memo(function DragOverlay({ venue }: Props) {
  const dragInfo = useUiStore((s) => s.dragInfo);
  const selectionRect = useUiStore((s) => s.selectionRect);
  const zoom = useUiStore((s) => s.viewport.zoom);
  const fontSize = LABEL_FONT_M / Math.max(zoom, 0.5);
  return (
    <Group listening={false}>
      {dragInfo && <DistanceGuides info={dragInfo} venue={venue} fontSize={fontSize} />}
      {selectionRect && (
        <Rect
          x={Math.min(selectionRect.x1, selectionRect.x2)}
          y={Math.min(selectionRect.y1, selectionRect.y2)}
          width={Math.abs(selectionRect.x2 - selectionRect.x1)}
          height={Math.abs(selectionRect.y2 - selectionRect.y1)}
          fill={withAlpha(COLORS.selection, 0.12)}
          stroke={COLORS.selection}
          strokeWidth={1}
          strokeScaleEnabled={false}
          dash={[4, 3]}
        />
      )}
    </Group>
  );
});

type GuideProps = {
  info: NonNullable<ReturnType<typeof useUiStore.getState>['dragInfo']>;
  venue: Venue;
  fontSize: number;
};

function DistanceGuides({ info, venue, fontSize }: GuideProps) {
  const { bounds } = info;
  const midY = bounds.y + bounds.height / 2;
  const midX = bounds.x + bounds.width / 2;
  const useLeft = info.left <= info.right;
  const useTop = info.top <= info.bottom;
  const hx1 = useLeft ? 0 : bounds.x + bounds.width;
  const hx2 = useLeft ? bounds.x : venue.widthM;
  const vy1 = useTop ? 0 : bounds.y + bounds.height;
  const vy2 = useTop ? bounds.y : venue.depthM;
  const hLabel = formatMeters(Math.max(0, useLeft ? info.left : info.right));
  const vLabel = formatMeters(Math.max(0, useTop ? info.top : info.bottom));
  return (
    <>
      <Line points={[hx1, midY, hx2, midY]} stroke={COLORS.guide} strokeWidth={1} strokeScaleEnabled={false} dash={[6, 4]} />
      <Label x={(hx1 + hx2) / 2} y={midY - fontSize * 0.9} text={hLabel} fontSize={fontSize} />
      <Line points={[midX, vy1, midX, vy2]} stroke={COLORS.guide} strokeWidth={1} strokeScaleEnabled={false} dash={[6, 4]} />
      <Label x={midX + fontSize * 0.4} y={(vy1 + vy2) / 2 - fontSize * 0.6} text={vLabel} fontSize={fontSize} align="left" />
    </>
  );
}

function Label({ x, y, text, fontSize, align = 'center' }: { x: number; y: number; text: string; fontSize: number; align?: 'center' | 'left' }) {
  const width = text.length * fontSize * 0.62 + fontSize * 0.6;
  const left = align === 'center' ? x - width / 2 : x;
  return (
    <Group>
      <Rect x={left} y={y - fontSize * 0.15} width={width} height={fontSize * 1.3} fill="#ffffff" opacity={0.9} cornerRadius={fontSize * 0.2} />
      <Text x={left} y={y} width={width} text={text} fontSize={fontSize} fill={COLORS.guide} align="center" />
    </Group>
  );
}
