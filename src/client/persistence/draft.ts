import { DRAFT_DEBOUNCE_MS } from '@shared/config/defaults';
import type { ProjectData } from '@shared/domain/types';

export const DRAFT_KEY = 'mesas:draft';

export type Draft = { baseVersion: number; savedAt: string; data: ProjectData };

let timer: ReturnType<typeof setTimeout> | null = null;

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** Reads the local draft, or null when there is none or it is unreadable. */
export function readDraft(): Draft | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Draft>;
    if (typeof parsed.baseVersion !== 'number' || typeof parsed.savedAt !== 'string' || typeof parsed.data !== 'object' || parsed.data === null) {
      return null;
    }
    return parsed as Draft;
  } catch {
    return null;
  }
}

/** Writes the draft immediately. */
export function writeDraft(draft: Draft): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    return;
  }
}

/** Removes the draft and cancels any pending write. */
export function clearDraft(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(DRAFT_KEY);
  } catch {
    return;
  }
}

/** Schedules a debounced draft write with the current unsaved state. */
export function scheduleDraft(data: ProjectData, baseVersion: number, debounceMs = DRAFT_DEBOUNCE_MS): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    writeDraft({ baseVersion, savedAt: new Date().toISOString(), data });
  }, debounceMs);
}

/** Decides whether the recovery dialog must be shown for a draft against the server document. */
export function shouldOfferDraft(draft: Draft | null, serverData: ProjectData): draft is Draft {
  if (!draft) return false;
  return JSON.stringify(draft.data) !== JSON.stringify(serverData);
}
