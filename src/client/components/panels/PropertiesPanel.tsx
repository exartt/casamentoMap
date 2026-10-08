import type { ProjectData } from '@shared/domain/types';
import { t } from '../../i18n/strings';
import { deleteElements, duplicateElements, rotateElements } from '../../store/actions';
import { getDerived } from '../../store/derived';
import { useProjectStore } from '../../store/projectStore';
import { btn, cx } from '../common/ui';
import { DoorPanel } from './DoorPanel';
import { FixturePanel } from './FixturePanel';
import { TablePanel } from './TablePanel';
import { VenuePanel } from './VenuePanel';

type Props = { project: ProjectData };

/** Shows the properties of the current selection, or the venue when nothing is selected. */
export function PropertiesPanel({ project }: Props) {
  const selection = useProjectStore((s) => s.selection);
  const derived = getDerived(project);
  if (selection.length === 0) return <VenuePanel project={project} />;
  if (selection.length > 1) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-gray-800">{t.venue.multiSelected(selection.length)}</p>
        <p className="text-xs text-gray-500">{t.venue.multiHint}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={cx(btn.base, btn.secondary, btn.small)} onClick={() => rotateElements(selection)}>
            Girar 90°
          </button>
          <button type="button" className={cx(btn.base, btn.secondary, btn.small)} onClick={() => duplicateElements(selection)}>
            {t.table.duplicate}
          </button>
          <button type="button" className={cx(btn.base, btn.danger, btn.small)} onClick={() => void deleteElements(selection)}>
            {t.app.remove}
          </button>
        </div>
      </div>
    );
  }
  const id = selection[0];
  const table = derived.tablesById.get(id);
  if (table) return <TablePanel key={table.id} table={table} project={project} />;
  const fixture = derived.fixturesById.get(id);
  if (fixture) return <FixturePanel key={fixture.id} fixture={fixture} />;
  const door = derived.doorsById.get(id);
  if (door) return <DoorPanel key={door.id} door={door} venue={project.venue} />;
  return <VenuePanel project={project} />;
}
