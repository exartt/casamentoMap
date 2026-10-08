import { downloadProjectJson } from '../../export/exportJson';
import { formatWhen } from '../../i18n/format';
import { t } from '../../i18n/strings';
import { cancelConflict, overwriteConflict } from '../../persistence/saveFlow';
import { useProjectStore } from '../../store/projectStore';
import { btn, cx } from '../common/ui';
import { Modal } from './Modal';

/** Warns that a newer version exists and offers cancel, download or overwrite. */
export function ConflictDialog() {
  const conflict = useProjectStore((s) => s.save.conflict);
  const updated = useProjectStore((s) => s.save.conflictUpdated);
  const saving = useProjectStore((s) => s.save.status === 'saving');
  const baseVersion = useProjectStore((s) => s.baseVersion);
  const project = useProjectStore((s) => s.project);
  if (!conflict || !project) return null;
  return (
    <Modal
      title={t.conflict.title}
      open
      onClose={cancelConflict}
      size="md"
      closeOnBackdrop={false}
      footer={
        <>
          <button type="button" className={cx(btn.base, btn.secondary)} onClick={cancelConflict} disabled={saving}>
            {t.conflict.cancel}
          </button>
          <button type="button" className={cx(btn.base, btn.secondary)} onClick={() => downloadProjectJson(project, '-minhas-alteracoes')} disabled={saving}>
            {t.conflict.download}
          </button>
          <button type="button" className={cx(btn.base, btn.danger)} onClick={() => void overwriteConflict()} disabled={saving}>
            {saving ? t.topbar.saving : t.conflict.overwrite}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        {updated && <p className="rounded-md bg-amber-50 px-3 py-2 text-amber-900">{t.conflict.updated}</p>}
        <p>{t.conflict.body(conflict.savedBy, conflict.currentVersion, formatWhen(conflict.savedAt), baseVersion)}</p>
        <p>{conflict.changesSinceBase ? t.conflict.changes(conflict.changesSinceBase) : t.conflict.changesUnknown}</p>
        <p>{t.conflict.warning}</p>
      </div>
    </Modal>
  );
}
