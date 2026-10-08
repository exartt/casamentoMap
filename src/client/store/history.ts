import { UNDO_HISTORY_LIMIT } from '@shared/config/defaults';
import type { ProjectData } from '@shared/domain/types';

export type History = { past: ProjectData[]; future: ProjectData[] };

/** Creates an empty undo/redo history. */
export function emptyHistory(): History {
  return { past: [], future: [] };
}

/** Records the current state as a past step and clears the redo stack. */
export function pushHistory(history: History, current: ProjectData, limit = UNDO_HISTORY_LIMIT): History {
  const past = [...history.past, current];
  if (past.length > limit) past.splice(0, past.length - limit);
  return { past, future: [] };
}

/** Steps back one state; returns null when there is nothing to undo. */
export function undoHistory(history: History, current: ProjectData): { history: History; state: ProjectData } | null {
  if (history.past.length === 0) return null;
  const state = history.past[history.past.length - 1];
  return { history: { past: history.past.slice(0, -1), future: [current, ...history.future] }, state };
}

/** Steps forward one state; returns null when there is nothing to redo. */
export function redoHistory(history: History, current: ProjectData): { history: History; state: ProjectData } | null {
  if (history.future.length === 0) return null;
  const state = history.future[0];
  return { history: { past: [...history.past, current], future: history.future.slice(1) }, state };
}
