import type { SaveResponse } from '@shared/api/schemas';
import { validateProject } from '@shared/domain/projectValidation';
import type { SaveConflict, SaveRequest } from '@shared/domain/types';
import { t } from '../i18n/strings';
import { selectIsDirty, useProjectStore, type PendingSave } from '../store/projectStore';
import { toastError, toastSuccess } from '../store/toastStore';
import { api, ApiError, NetworkError } from './apiClient';
import { clearDraft } from './draft';

export type SaveApi = { saveProject: (body: SaveRequest) => Promise<SaveResponse> };

export type SaveOutcome = 'saved' | 'conflict' | 'error' | 'invalid' | 'noop';

const CONFLICT_STATUS = 409;

const VALIDATION_STATUS = 422;

const UNAUTHORIZED_STATUS = 401;

function newSaveId(): string {
  return crypto.randomUUID();
}

function reusableSaveId(pending: PendingSave | null, data: SaveRequest['data']): string {
  return pending && pending.data === data ? pending.saveId : newSaveId();
}

/** Sends the current editor state to the server, handling replay, conflicts and errors. */
export async function performSave(
  options: { api?: SaveApi; force?: boolean; expectedVersion?: number } = {},
): Promise<SaveOutcome> {
  const client = options.api ?? api;
  const store = useProjectStore.getState();
  if (!store.project || store.save.status === 'saving') return 'noop';
  if (!selectIsDirty(store) && !options.force) return 'noop';
  const data = store.project;
  const validation = validateProject(data);
  if (!validation.ok) {
    toastError(t.toasts.invalidProject, validation.problems);
    return 'invalid';
  }
  const saveId = reusableSaveId(store.save.pending, data);
  const request: SaveRequest = { saveId, baseVersion: store.baseVersion, data };
  if (options.force) {
    request.force = true;
    request.expectedVersion = options.expectedVersion;
  }
  store.setSaveState({ status: 'saving', error: null, pending: { saveId, data } });
  try {
    const response = await client.saveProject(request);
    const user = useProjectStore.getState().user;
    useProjectStore.getState().markSaved(data, {
      version: response.version,
      savedBy: user ? user.name : '',
      savedAt: response.savedAt,
    });
    clearDraft();
    toastSuccess(options.force ? t.toasts.overwritten(response.version) : t.toasts.saved(response.version));
    return 'saved';
  } catch (error) {
    const current = useProjectStore.getState();
    if (error instanceof ApiError && error.status === CONFLICT_STATUS) {
      const conflict = error.details as SaveConflict;
      current.setSaveState({
        status: 'idle',
        error: null,
        conflict,
        conflictUpdated: current.save.conflict !== null,
      });
      return 'conflict';
    }
    if (error instanceof ApiError && error.status === VALIDATION_STATUS) {
      const details = error.details as { problems?: string[] } | undefined;
      current.setSaveState({ status: 'idle', error: null, pending: null });
      toastError(t.toasts.invalidProject, details?.problems ?? []);
      return 'invalid';
    }
    if (error instanceof ApiError && error.status === UNAUTHORIZED_STATUS) {
      current.setSaveState({ status: 'error', error: t.app.sessionExpired });
      return 'error';
    }
    const message = error instanceof NetworkError ? t.topbar.saveError : error instanceof ApiError ? error.message : t.topbar.saveError;
    current.setSaveState({ status: 'error', error: message });
    return 'error';
  }
}

/** Closes the conflict dialog keeping the unsaved changes in the editor. */
export function cancelConflict(): void {
  useProjectStore.getState().setSaveState({ conflict: null, conflictUpdated: false });
}

/** Resends the save with force, using the version shown in the dialog as expectedVersion. */
export async function overwriteConflict(options: { api?: SaveApi } = {}): Promise<SaveOutcome> {
  const conflict = useProjectStore.getState().save.conflict;
  if (!conflict) return 'noop';
  return performSave({ api: options.api, force: true, expectedVersion: conflict.currentVersion });
}
