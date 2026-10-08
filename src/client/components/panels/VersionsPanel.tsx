import { useCallback, useEffect, useState } from 'react';
import type { SavedVersion } from '@shared/domain/types';
import { downloadProjectJson } from '../../export/exportJson';
import { formatWhen } from '../../i18n/format';
import { t } from '../../i18n/strings';
import { api, errorMessage } from '../../persistence/apiClient';
import { confirmDialog } from '../../store/confirmStore';
import { useProjectStore } from '../../store/projectStore';
import { toastError, toastSuccess } from '../../store/toastStore';
import { btn, cx } from '../common/ui';

/** Version history with download and "load into editor" actions. */
export function VersionsPanel() {
  const [versions, setVersions] = useState<SavedVersion[] | null>(null);
  const [currentVersion, setCurrentVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const serverVersion = useProjectStore((s) => s.serverInfo?.version ?? 0);
  const replaceProject = useProjectStore((s) => s.replaceProject);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listVersions();
      setVersions(res.versions);
      setCurrentVersion(res.currentVersion);
    } catch (e) {
      setError(errorMessage(e, t.versions.loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, serverVersion]);

  const download = async (version: number) => {
    try {
      const res = await api.getVersion(version);
      downloadProjectJson(res.data, `-v${version}`);
    } catch (e) {
      toastError(errorMessage(e));
    }
  };

  const loadIntoEditor = async (version: number) => {
    const ok = await confirmDialog({ message: t.versions.loadConfirm(version), confirmLabel: t.versions.load });
    if (!ok) return;
    try {
      const res = await api.getVersion(version);
      replaceProject(res.data, { baseVersion: currentVersion, editingCopyOfVersion: version, keepHistory: true });
      toastSuccess(t.toasts.versionLoaded(version));
    } catch (e) {
      toastError(errorMessage(e));
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">{loading ? t.app.loading : versions ? `${versions.length} versões` : ''}</span>
        <button type="button" className={cx(btn.base, btn.secondary, btn.small)} onClick={() => void load()} disabled={loading}>
          {t.versions.refresh}
        </button>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {versions && versions.length === 0 && <p className="text-sm text-gray-600">{t.versions.empty}</p>}
      <ul className="flex flex-col gap-1.5">
        {versions?.map((v) => (
          <li key={v.version} className={cx('rounded-md border px-2.5 py-2 text-sm', v.version === currentVersion ? 'border-brand-300 bg-brand-50' : 'border-gray-200 bg-white')}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-semibold text-gray-900">
                v{v.version}
                {v.version === currentVersion && <span className="ml-1 text-xs font-normal text-brand-700">({t.versions.current})</span>}
              </span>
              <span className="text-xs text-gray-500">{formatWhen(v.savedAt)}</span>
            </div>
            <div className="text-xs text-gray-700">
              {t.versions.savedBy(v.savedBy)} · {v.summary}
              {v.overwroteVersion !== null && <span className="text-amber-800"> · {t.versions.overwrote(v.overwroteVersion, v.overwroteSavedBy)}</span>}
            </div>
            <div className="mt-1 flex gap-2">
              <button type="button" className={cx(btn.base, btn.secondary, btn.small)} onClick={() => void download(v.version)}>
                {t.versions.download}
              </button>
              <button type="button" className={cx(btn.base, btn.secondary, btn.small)} onClick={() => void loadIntoEditor(v.version)}>
                {t.versions.load}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
