import { formatMeters } from '@shared/domain/text';
import { exportSeatingCsv } from '../../export/exportCsv';
import { downloadProjectJson } from '../../export/exportJson';
import { exportPlanPng } from '../../export/exportPng';
import { t } from '../../i18n/strings';
import { api, errorMessage } from '../../persistence/apiClient';
import { clearDraft } from '../../persistence/draft';
import { performSave } from '../../persistence/saveFlow';
import { renumberAllTables } from '../../store/actions';
import { confirmDialog } from '../../store/confirmStore';
import { selectIsDirty, useProjectStore } from '../../store/projectStore';
import { toastError, toastSuccess } from '../../store/toastStore';
import { useUiStore } from '../../store/uiStore';
import { Menu } from '../common/Menu';
import { btn, cx } from '../common/ui';

type Props = { onPrint: () => void };

/** Top toolbar: project name, save button and indicator, undo/redo, import, export, settings and menus. */
export function TopBar({ onPrint }: Props) {
  const project = useProjectStore((s) => s.project);
  const user = useProjectStore((s) => s.user);
  const dirty = useProjectStore(selectIsDirty);
  const saveStatus = useProjectStore((s) => s.save.status);
  const saveError = useProjectStore((s) => s.save.error);
  const serverVersion = useProjectStore((s) => s.serverInfo?.version ?? 0);
  const editingCopy = useProjectStore((s) => s.editingCopyOfVersion);
  const canUndo = useProjectStore((s) => s.history.past.length > 0);
  const canRedo = useProjectStore((s) => s.history.future.length > 0);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const openDialog = useUiStore((s) => s.openDialog);
  const requestFit = useUiStore((s) => s.requestFit);
  const setEventMode = useUiStore((s) => s.setEventMode);

  if (!project || !user) return null;
  const saving = saveStatus === 'saving';

  const logout = async () => {
    if (dirty) {
      const ok = await confirmDialog({ message: t.beforeUnload, confirmLabel: t.topbar.logout, destructive: true });
      if (!ok) return;
    }
    try {
      await api.logout();
    } catch (error) {
      toastError(errorMessage(error));
    }
    clearDraft();
    window.location.href = '/login';
  };

  const exportPng = async () => {
    try {
      const ok = await exportPlanPng(project);
      if (ok) toastSuccess(t.export.pngDone);
    } catch (error) {
      toastError(errorMessage(error));
    }
  };

  return (
    <header className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-3 py-2">
      <div className="mr-2 min-w-0">
        <div className="truncate text-sm font-semibold text-gray-900">{project.name}</div>
        <div className="text-xs text-gray-500">
          {formatMeters(project.venue.widthM)} × {formatMeters(project.venue.depthM)}
        </div>
      </div>

      <button
        type="button"
        className={cx(btn.base, btn.primary, 'min-w-[7rem]')}
        disabled={!dirty || saving}
        onClick={() => void performSave()}
        title="Ctrl+S"
      >
        {saving ? t.topbar.saving : t.app.save}
      </button>
      <span className={cx('text-xs', saveError ? 'text-red-700' : dirty ? 'text-amber-700' : 'text-gray-500')} aria-live="polite">
        {saveError ? saveError : dirty ? t.topbar.unsaved : t.topbar.saved(serverVersion)}
      </span>
      {editingCopy !== null && <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">{t.topbar.editingCopy(editingCopy)}</span>}

      <div className="mx-1 h-6 border-l border-gray-200" />
      <button type="button" className={cx(btn.base, btn.secondary, btn.icon)} disabled={!canUndo} onClick={undo} title={`${t.topbar.undo} (Ctrl+Z)`} aria-label={t.topbar.undo}>
        ↶
      </button>
      <button type="button" className={cx(btn.base, btn.secondary, btn.icon)} disabled={!canRedo} onClick={redo} title={`${t.topbar.redo} (Ctrl+Y)`} aria-label={t.topbar.redo}>
        ↷
      </button>

      <div className="mx-1 h-6 border-l border-gray-200" />
      <button type="button" className={cx(btn.base, btn.secondary)} onClick={() => openDialog('importGuests')}>
        {t.topbar.importGuests}
      </button>
      <button type="button" className={cx(btn.base, btn.secondary)} onClick={() => openDialog('tableList')}>
        {t.topbar.tableList}
      </button>
      <button type="button" className={cx(btn.base, btn.secondary, 'border-brand-400 text-brand-800')} onClick={() => setEventMode(true)}>
        ★ {t.eventMode.button}
      </button>
      <Menu
        label={t.topbar.export}
        items={[
          { label: t.topbar.exportPng, onSelect: () => void exportPng() },
          { label: t.topbar.exportCsv, onSelect: () => { exportSeatingCsv(project); toastSuccess(t.export.csvDone); } },
          { label: t.topbar.exportJson, onSelect: () => { downloadProjectJson(project); toastSuccess(t.export.jsonDone); } },
          { separator: true },
          { label: t.topbar.print, onSelect: onPrint },
        ]}
      />
      <Menu
        label={t.topbar.settings}
        items={[
          { label: t.topbar.settings, onSelect: () => openDialog('settings') },
          { label: t.topbar.fitToScreen, onSelect: requestFit },
          { label: t.topbar.renumber, onSelect: renumberAllTables },
          { separator: true },
          { label: t.shortcuts.title, onSelect: () => openDialog('shortcuts') },
        ]}
      />

      <div className="ml-auto flex items-center gap-2">
        {user.role === 'admin' && (
          <Menu
            label={t.topbar.admin}
            align="right"
            items={[
              { label: t.topbar.users, onSelect: () => openDialog('users') },
              { label: t.topbar.shareLinks, onSelect: () => openDialog('shareLinks') },
              { separator: true },
              { label: t.topbar.importProject, onSelect: () => openDialog('importProject') },
            ]}
          />
        )}
        <Menu
          label={user.name}
          align="right"
          ariaLabel={t.topbar.user}
          items={[
            { label: t.topbar.changePassword, onSelect: () => openDialog('changePassword') },
            { separator: true },
            { label: t.topbar.logout, onSelect: () => void logout(), danger: true },
          ]}
        />
      </div>
    </header>
  );
}
