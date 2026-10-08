import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SaveResponse } from '@shared/api/schemas';
import { createEmptyProject } from '@shared/domain/projectMigration';
import { createTable } from '@shared/domain/seating';
import type { SaveRequest } from '@shared/domain/types';
import { ApiError, NetworkError } from '@client/persistence/apiClient';
import { cancelConflict, overwriteConflict, performSave, type SaveApi } from '@client/persistence/saveFlow';
import { selectIsDirty, useProjectStore } from '@client/store/projectStore';
import { useToastStore } from '@client/store/toastStore';

function loadProject(version = 12) {
  const data = createEmptyProject('Casamento');
  useProjectStore.getState().initialize({
    user: { id: 'u1', name: 'Noivo', email: 'noivo@exemplo.com', role: 'editor', mustChangePassword: false },
    csrfToken: 'csrf',
    project: { version, savedBy: 'Noiva', savedAt: new Date().toISOString(), data },
  });
}

function addTable(label = 'Mesa 1') {
  useProjectStore.getState().commit((p) => ({ ...p, tables: [...p.tables, createTable(crypto.randomUUID(), 'square', { x: 5, y: 5 }, label)] }));
}

function okApi(version: number): SaveApi & { calls: SaveRequest[] } {
  const calls: SaveRequest[] = [];
  return {
    calls,
    saveProject: async (body) => {
      calls.push(body);
      const response: SaveResponse = { version, savedAt: new Date().toISOString(), summary: '1 mesa adicionada', replayed: false };
      return response;
    },
  };
}

function conflictApi(currentVersion: number): SaveApi & { calls: SaveRequest[] } {
  const calls: SaveRequest[] = [];
  return {
    calls,
    saveProject: async (body) => {
      calls.push(body);
      throw new ApiError(409, 'VERSION_CONFLICT', 'Existe uma versão mais nova.', 'req', {
        currentVersion,
        savedBy: 'Noiva',
        savedAt: new Date().toISOString(),
        changesSinceBase: '2 mesas movidas e 5 convidados alocados',
      });
    },
  };
}

beforeEach(() => {
  useProjectStore.getState().reset();
  useToastStore.setState({ toasts: [] });
  localStorage.clear();
});

describe('saveFlow', () => {
  it('tracks unsaved changes and clears the indicator after undo back to the saved state', () => {
    loadProject();
    expect(selectIsDirty(useProjectStore.getState())).toBe(false);
    addTable();
    expect(selectIsDirty(useProjectStore.getState())).toBe(true);
    useProjectStore.getState().undo();
    expect(selectIsDirty(useProjectStore.getState())).toBe(false);
  });

  it('does nothing when there are no changes', async () => {
    loadProject();
    const api = okApi(13);
    expect(await performSave({ api })).toBe('noop');
    expect(api.calls).toHaveLength(0);
  });

  it('saves and updates the base version', async () => {
    loadProject(12);
    addTable();
    const api = okApi(13);
    expect(await performSave({ api })).toBe('saved');
    const state = useProjectStore.getState();
    expect(state.baseVersion).toBe(13);
    expect(selectIsDirty(state)).toBe(false);
    expect(api.calls[0].baseVersion).toBe(12);
    expect(api.calls[0].force).toBeUndefined();
    expect(state.serverInfo?.savedBy).toBe('Noivo');
  });

  it('a 409 opens the conflict dialog and keeps the changes', async () => {
    loadProject(12);
    addTable();
    const api = conflictApi(13);
    expect(await performSave({ api })).toBe('conflict');
    const state = useProjectStore.getState();
    expect(state.save.conflict?.currentVersion).toBe(13);
    expect(state.save.conflict?.savedBy).toBe('Noiva');
    expect(state.save.conflictUpdated).toBe(false);
    expect(selectIsDirty(state)).toBe(true);
    expect(state.project?.tables).toHaveLength(1);
  });

  it('cancel keeps the state and closes the dialog', async () => {
    loadProject(12);
    addTable();
    await performSave({ api: conflictApi(13) });
    cancelConflict();
    const state = useProjectStore.getState();
    expect(state.save.conflict).toBeNull();
    expect(selectIsDirty(state)).toBe(true);
    expect(state.baseVersion).toBe(12);
  });

  it('overwrite resends with force and the expectedVersion shown in the dialog', async () => {
    loadProject(12);
    addTable();
    const first = conflictApi(13);
    await performSave({ api: first });
    const second = okApi(14);
    expect(await overwriteConflict({ api: second })).toBe('saved');
    expect(second.calls[0].force).toBe(true);
    expect(second.calls[0].expectedVersion).toBe(13);
    expect(second.calls[0].saveId).toBe(first.calls[0].saveId);
    expect(useProjectStore.getState().baseVersion).toBe(14);
  });

  it('a new 409 during overwrite updates the dialog instead of saving', async () => {
    loadProject(12);
    addTable();
    await performSave({ api: conflictApi(13) });
    expect(await overwriteConflict({ api: conflictApi(14) })).toBe('conflict');
    const state = useProjectStore.getState();
    expect(state.save.conflict?.currentVersion).toBe(14);
    expect(state.save.conflictUpdated).toBe(true);
    expect(state.baseVersion).toBe(12);
  });

  it('a network failure keeps the changes and the retry reuses the saveId', async () => {
    loadProject(12);
    addTable();
    const calls: SaveRequest[] = [];
    const failing: SaveApi = {
      saveProject: async (body) => {
        calls.push(body);
        throw new NetworkError('falha', false);
      },
    };
    expect(await performSave({ api: failing })).toBe('error');
    let state = useProjectStore.getState();
    expect(state.save.status).toBe('error');
    expect(state.save.error).toBe('Não foi possível salvar. Tente de novo.');
    expect(selectIsDirty(state)).toBe(true);
    const ok = okApi(13);
    expect(await performSave({ api: ok })).toBe('saved');
    expect(ok.calls[0].saveId).toBe(calls[0].saveId);
    state = useProjectStore.getState();
    expect(state.baseVersion).toBe(13);
  });

  it('a 422 shows the problems and does not change the base version', async () => {
    loadProject(12);
    addTable();
    const spy = vi.spyOn(useToastStore.getState(), 'push');
    const api: SaveApi = {
      saveProject: async () => {
        throw new ApiError(422, 'VALIDATION_FAILED', 'inválido', 'req', { problems: ['Mesa 1: ocupação acima da capacidade'] });
      },
    };
    expect(await performSave({ api })).toBe('invalid');
    expect(useProjectStore.getState().baseVersion).toBe(12);
    spy.mockRestore();
  });

  it('coalesces quick edits with the same key into one undo step', () => {
    loadProject();
    const store = useProjectStore.getState();
    store.commit((p) => ({ ...p, name: 'A' }), { coalesceKey: 'name' });
    store.commit((p) => ({ ...p, name: 'AB' }), { coalesceKey: 'name' });
    store.commit((p) => ({ ...p, name: 'ABC' }), { coalesceKey: 'name' });
    expect(useProjectStore.getState().history.past).toHaveLength(1);
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().project?.name).toBe('Casamento');
  });
});
