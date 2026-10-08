import { formatDecimal } from '@shared/domain/text';
import { formatWhen } from '../../i18n/format';
import { t } from '../../i18n/strings';
import { getDerived } from '../../store/derived';
import { useProjectStore } from '../../store/projectStore';
import { useUiStore } from '../../store/uiStore';

/** Bottom bar with counters, the open version and the cursor position and zoom. */
export function StatusBar() {
  const project = useProjectStore((s) => s.project);
  const serverInfo = useProjectStore((s) => s.serverInfo);
  const cursor = useUiStore((s) => s.cursorM);
  const zoom = useUiStore((s) => s.viewport.zoom);
  if (!project) return null;
  const counters = getDerived(project).counters;
  return (
    <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-200 bg-white px-3 py-1 text-xs text-gray-600">
      <span>{t.status.guests(counters.guests, counters.seated, counters.unseated)}</span>
      <span>{t.status.tables(counters.tables, counters.enabledSeats, counters.freeSeats)}</span>
      {serverInfo && <span>{t.status.version(serverInfo.version, serverInfo.savedBy, formatWhen(serverInfo.savedAt))}</span>}
      <span className="ml-auto tabular-nums">
        {cursor ? t.status.cursor(`${formatDecimal(cursor.x)} m`, `${formatDecimal(cursor.y)} m`) : ''}
      </span>
      <span className="tabular-nums">{t.status.zoom(Math.round(zoom * 100))}</span>
    </footer>
  );
}
