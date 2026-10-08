import type Konva from 'konva';
import { useEffect, useRef } from 'react';
import { Transformer } from 'react-konva';
import { ROTATION_SNAP_DEG } from '@shared/config/defaults';
import type { ElementRef } from '@shared/domain/types';
import { useUiStore } from '../../store/uiStore';
import { COLORS } from './canvasUtils';

type Props = {
  selected: ElementRef | null;
  node: Konva.Group | null;
  keepRatio: boolean;
  onRotateEnd: (ref: ElementRef, node: Konva.Group) => void;
};

const ROTATION_SNAPS = Array.from({ length: 360 / ROTATION_SNAP_DEG }, (_, i) => i * ROTATION_SNAP_DEG);

const MIN_SIZE_PX = 12;

/** Attaches a Konva transformer to the single selected table (rotation only) or fixture (rotation and resize). */
export function SelectionTransformer({ selected, node, keepRatio, onRotateEnd }: Props) {
  const ref = useRef<Konva.Transformer>(null);
  const shiftHeld = useUiStore((s) => s.shiftHeld);

  useEffect(() => {
    const tr = ref.current;
    if (!tr) return;
    tr.nodes(node && selected && selected.type !== 'door' ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [node, selected]);

  if (!selected || selected.type === 'door') return null;
  const isTable = selected.type === 'table';
  return (
    <Transformer
      ref={ref}
      rotateEnabled
      resizeEnabled={!isTable}
      enabledAnchors={isTable ? [] : ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right', 'top-center', 'bottom-center']}
      keepRatio={keepRatio}
      rotationSnaps={shiftHeld ? [] : ROTATION_SNAPS}
      rotationSnapTolerance={6}
      rotateAnchorOffset={24}
      anchorSize={9}
      anchorStroke={COLORS.selection}
      anchorFill="#ffffff"
      borderStroke={COLORS.selection}
      borderDash={[4, 3]}
      ignoreStroke
      flipEnabled={false}
      boundBoxFunc={(oldBox, newBox) => (newBox.width < MIN_SIZE_PX || newBox.height < MIN_SIZE_PX ? oldBox : newBox)}
      onTransformEnd={() => {
        if (node && selected) onRotateEnd(selected, node);
      }}
    />
  );
}
