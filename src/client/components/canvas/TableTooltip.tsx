import { tableOccupancy } from '@shared/domain/seating';
import type { ProjectData } from '@shared/domain/types';
import { getDerived } from '../../store/derived';
import { useUiStore } from '../../store/uiStore';
import { worldToScreen } from './canvasUtils';

type Props = { project: ProjectData };

const MAX_NAMES = 6;

/** HTML tooltip with label, occupancy and first guest names of the hovered table. */
export function TableTooltip({ project }: Props) {
  const hoverTableId = useUiStore((s) => s.hoverTableId);
  const dragging = useUiStore((s) => s.dragDelta !== null || s.dragInfo !== null);
  const viewport = useUiStore((s) => s.viewport);
  if (!hoverTableId || dragging) return null;
  const derived = getDerived(project);
  const table = derived.tablesById.get(hoverTableId);
  if (!table) return null;
  const occ = tableOccupancy(table);
  const names = table.seats
    .filter((s) => s.guestId)
    .map((s) => derived.guestsById.get(s.guestId as string)?.name ?? '')
    .filter((n) => n !== '');
  const shown = names.slice(0, MAX_NAMES);
  const rest = names.length - shown.length;
  const screen = worldToScreen({ x: table.x, y: table.y - table.depthM / 2 - 0.8 }, viewport);
  return (
    <div
      className="pointer-events-none absolute z-20 max-w-xs -translate-x-1/2 -translate-y-full rounded-md bg-gray-900/90 px-3 py-2 text-xs text-white shadow-lg"
      style={{ left: screen.x, top: screen.y }}
      role="tooltip"
    >
      <div className="font-semibold">
        {table.label} · {occ.occupied}/{occ.enabled}
      </div>
      {shown.length > 0 && (
        <div className="mt-1 text-gray-200">
          {shown.join(', ')}
          {rest > 0 ? ` e mais ${rest}` : ''}
        </div>
      )}
    </div>
  );
}
