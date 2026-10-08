import { DOOR_SPECS, FIXTURE_PALETTE_ORDER, FIXTURE_SPECS } from '@shared/config/defaults';
import type { DoorKind, FixtureKind } from '@shared/domain/types';
import { t } from '../../i18n/strings';
import { addDoor, addFixture, addTable } from '../../store/actions';
import { useProjectStore } from '../../store/projectStore';
import { useUiStore } from '../../store/uiStore';
import { PALETTE_DRAG_TYPE, type PaletteItem } from '../canvas/PaletteTypes';
import { visibleCenter } from '../canvas/canvasUtils';
import { cx } from '../common/ui';

const DOOR_ORDER: DoorKind[] = ['main', 'service', 'emergency'];

function placeAtCenter(item: PaletteItem): void {
  const ui = useUiStore.getState();
  const project = useProjectStore.getState().project;
  if (!project) return;
  const center = visibleCenter(ui.viewport, ui.stageSize);
  const point = {
    x: Math.max(0.5, Math.min(project.venue.widthM - 0.5, center.x)),
    y: Math.max(0.5, Math.min(project.venue.depthM - 0.5, center.y)),
  };
  if (item.type === 'table') addTable(item.kind, point, item.couple);
  else if (item.type === 'fixture') addFixture(item.kind, point);
  else addDoor(item.kind);
  ui.setActiveTab('properties');
}

function PaletteButton({ item, label, color }: { item: PaletteItem; label: string; color?: string }) {
  return (
    <button
      type="button"
      draggable
      className={cx(
        'flex w-full items-center gap-2 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-left text-sm text-gray-800 hover:border-brand-400 hover:bg-brand-50',
        'cursor-grab active:cursor-grabbing',
      )}
      onClick={() => placeAtCenter(item)}
      onDragStart={(e) => {
        e.dataTransfer.setData(PALETTE_DRAG_TYPE, JSON.stringify(item));
        e.dataTransfer.effectAllowed = 'copy';
      }}
    >
      <span className="inline-block h-3.5 w-3.5 shrink-0 rounded-sm border border-gray-400" style={{ backgroundColor: color ?? '#f4f1ea' }} aria-hidden="true" />
      <span className="truncate">{label}</span>
    </button>
  );
}

/** Left palette with tables, fixtures and doors; click adds at the visible center, drag drops on the canvas. */
export function Palette() {
  return (
    <aside className="flex h-full w-52 shrink-0 flex-col gap-3 overflow-y-auto border-r border-gray-200 bg-gray-50 p-3" aria-label={t.palette.title}>
      <div>
        <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">{t.palette.tables}</h2>
        <div className="flex flex-col gap-1.5">
          <PaletteButton item={{ type: 'table', kind: 'banquet' }} label={t.palette.banquet} />
          <PaletteButton item={{ type: 'table', kind: 'square' }} label={t.palette.square} />
          <PaletteButton item={{ type: 'table', kind: 'banquet', couple: true }} label={t.palette.coupleTable} color="#f6e3b4" />
        </div>
      </div>
      <div>
        <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">{t.palette.fixtures}</h2>
        <div className="flex flex-col gap-1.5">
          {FIXTURE_PALETTE_ORDER.map((kind: FixtureKind) => (
            <PaletteButton key={kind} item={{ type: 'fixture', kind }} label={FIXTURE_SPECS[kind].labelPt} color={FIXTURE_SPECS[kind].color} />
          ))}
        </div>
      </div>
      <div>
        <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">{t.palette.doors}</h2>
        <div className="flex flex-col gap-1.5">
          {DOOR_ORDER.map((kind) => (
            <PaletteButton key={kind} item={{ type: 'door', kind }} label={DOOR_SPECS[kind].labelPt} color={DOOR_SPECS[kind].color} />
          ))}
        </div>
      </div>
      <p className="mt-auto text-xs text-gray-500">{t.palette.hint}</p>
    </aside>
  );
}
