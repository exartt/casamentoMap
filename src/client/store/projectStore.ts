import { create } from 'zustand';
import type { ProjectInfo, ProjectResponse } from '@shared/api/schemas';
import type { ProjectData, SaveConflict, User } from '@shared/domain/types';
import { emptyHistory, pushHistory, redoHistory, undoHistory, type History } from './history';

const COALESCE_WINDOW_MS = 1000;

export type SaveStatus = 'idle' | 'saving' | 'error';

export type PendingSave = { saveId: string; data: ProjectData };

export type SaveState = {
  status: SaveStatus;
  error: string | null;
  conflict: SaveConflict | null;
  conflictUpdated: boolean;
  pending: PendingSave | null;
};

export type CommitOptions = {
  coalesceKey?: string;
  recordHistory?: boolean;
};

export type ReplaceOptions = {
  baseVersion?: number;
  editingCopyOfVersion?: number | null;
  keepHistory?: boolean;
};

export type EditorState = {
  user: User | null;
  csrfToken: string;
  project: ProjectData | null;
  savedProject: ProjectData | null;
  baseVersion: number;
  serverInfo: ProjectInfo | null;
  history: History;
  lastCommit: { key: string; at: number } | null;
  selection: string[];
  editingCopyOfVersion: number | null;
  save: SaveState;
  initialize: (response: ProjectResponse) => void;
  setUser: (user: User | null) => void;
  commit: (updater: (project: ProjectData) => ProjectData, options?: CommitOptions) => void;
  replaceProject: (data: ProjectData, options?: ReplaceOptions) => void;
  undo: () => void;
  redo: () => void;
  setSelection: (ids: string[]) => void;
  toggleSelection: (id: string) => void;
  clearSelection: () => void;
  markSaved: (data: ProjectData, info: ProjectInfo) => void;
  setSaveState: (partial: Partial<SaveState>) => void;
  reset: () => void;
};

const initialSave: SaveState = { status: 'idle', error: null, conflict: null, conflictUpdated: false, pending: null };

export const useProjectStore = create<EditorState>((set, get) => ({
  user: null,
  csrfToken: '',
  project: null,
  savedProject: null,
  baseVersion: 0,
  serverInfo: null,
  history: emptyHistory(),
  lastCommit: null,
  selection: [],
  editingCopyOfVersion: null,
  save: { ...initialSave },

  initialize: (response) => {
    const { data, ...info } = response.project;
    set({
      user: response.user,
      csrfToken: response.csrfToken,
      project: data,
      savedProject: data,
      baseVersion: info.version,
      serverInfo: info,
      history: emptyHistory(),
      lastCommit: null,
      selection: [],
      editingCopyOfVersion: null,
      save: { ...initialSave },
    });
  },

  setUser: (user) => set({ user }),

  commit: (updater, options = {}) => {
    const state = get();
    if (!state.project) return;
    const next = updater(state.project);
    if (next === state.project) return;
    const record = options.recordHistory !== false;
    const now = Date.now();
    const coalesce =
      record &&
      options.coalesceKey !== undefined &&
      state.lastCommit !== null &&
      state.lastCommit.key === options.coalesceKey &&
      now - state.lastCommit.at < COALESCE_WINDOW_MS;
    const history = record && !coalesce ? pushHistory(state.history, state.project) : state.history;
    set({
      project: next,
      history,
      lastCommit: record && options.coalesceKey !== undefined ? { key: options.coalesceKey, at: now } : null,
    });
  },

  replaceProject: (data, options = {}) => {
    const state = get();
    set({
      project: data,
      history: options.keepHistory && state.project ? pushHistory(state.history, state.project) : emptyHistory(),
      lastCommit: null,
      baseVersion: options.baseVersion ?? state.baseVersion,
      editingCopyOfVersion: options.editingCopyOfVersion === undefined ? state.editingCopyOfVersion : options.editingCopyOfVersion,
      selection: [],
    });
  },

  undo: () => {
    const state = get();
    if (!state.project) return;
    const result = undoHistory(state.history, state.project);
    if (!result) return;
    set({ project: result.state, history: result.history, lastCommit: null });
  },

  redo: () => {
    const state = get();
    if (!state.project) return;
    const result = redoHistory(state.history, state.project);
    if (!result) return;
    set({ project: result.state, history: result.history, lastCommit: null });
  },

  setSelection: (ids) => set({ selection: ids }),

  toggleSelection: (id) => {
    const current = get().selection;
    set({ selection: current.includes(id) ? current.filter((x) => x !== id) : [...current, id] });
  },

  clearSelection: () => {
    if (get().selection.length > 0) set({ selection: [] });
  },

  markSaved: (data, info) => {
    set({
      savedProject: data,
      baseVersion: info.version,
      serverInfo: info,
      editingCopyOfVersion: null,
      save: { ...initialSave },
    });
  },

  setSaveState: (partial) => set({ save: { ...get().save, ...partial } }),

  reset: () =>
    set({
      user: null,
      csrfToken: '',
      project: null,
      savedProject: null,
      baseVersion: 0,
      serverInfo: null,
      history: emptyHistory(),
      lastCommit: null,
      selection: [],
      editingCopyOfVersion: null,
      save: { ...initialSave },
    }),
}));

/** Returns true when the editor has changes that differ from the last saved state. */
export function selectIsDirty(state: Pick<EditorState, 'project' | 'savedProject'>): boolean {
  return state.project !== null && state.project !== state.savedProject;
}
