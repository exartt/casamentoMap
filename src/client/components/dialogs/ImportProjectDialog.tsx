import { useState } from 'react';
import { migrateProjectData } from '@shared/domain/projectMigration';
import { validateProject } from '@shared/domain/projectValidation';
import type { ProjectData } from '@shared/domain/types';
import { t } from '../../i18n/strings';
import { confirmDialog } from '../../store/confirmStore';
import { useProjectStore } from '../../store/projectStore';
import { toastSuccess } from '../../store/toastStore';
import { btn, cx, label } from '../common/ui';
import { Modal } from './Modal';

type Props = { onClose: () => void };

/** Loads a project JSON file into the editor as unsaved changes (admin). */
export function ImportProjectDialog({ onClose }: Props) {
  const replaceProject = useProjectStore((s) => s.replaceProject);
  const [data, setData] = useState<ProjectData | null>(null);
  const [problems, setProblems] = useState<string[]>([]);

  const onFile = async (file: File | undefined) => {
    setData(null);
    setProblems([]);
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text()) as unknown;
      const result = validateProject(migrateProjectData(raw));
      if (result.ok) setData(result.data);
      else setProblems(result.problems);
    } catch {
      setProblems([t.importProject.invalid]);
    }
  };

  const load = async () => {
    if (!data) return;
    const ok = await confirmDialog({ message: t.importProject.confirm, confirmLabel: t.importProject.title });
    if (!ok) return;
    replaceProject(data, { keepHistory: true, editingCopyOfVersion: null });
    toastSuccess(t.importProject.done);
    onClose();
  };

  return (
    <Modal
      title={t.importProject.title}
      open
      onClose={onClose}
      size="sm"
      footer={
        <>
          <button type="button" className={cx(btn.base, btn.secondary)} onClick={onClose}>
            {t.app.cancel}
          </button>
          <button type="button" className={cx(btn.base, btn.primary)} onClick={() => void load()} disabled={!data}>
            {t.importProject.title}
          </button>
        </>
      }
    >
      <p className="mb-3 text-gray-600">{t.importProject.intro}</p>
      <label className={label}>{t.importProject.file}</label>
      <input type="file" accept=".json,application/json" className="block w-full text-sm" onChange={(e) => void onFile(e.target.files?.[0])} />
      {data && (
        <p className="mt-2 text-xs text-gray-600">
          {data.name} · {data.tables.length} mesas · {data.guests.length} convidados
        </p>
      )}
      {problems.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-xs text-red-700">
          {problems.slice(0, 10).map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
