import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyProject } from '@shared/domain/projectMigration';
import { createTable } from '@shared/domain/seating';
import { clearDraft, readDraft, scheduleDraft, shouldOfferDraft, writeDraft } from '@client/persistence/draft';
import { t } from '@client/i18n/strings';
import { formatWhen } from '@client/i18n/format';

beforeEach(() => {
  localStorage.clear();
  clearDraft();
});

describe('draft', () => {
  it('offers the draft only when it differs from the server document', () => {
    const server = createEmptyProject('Casamento');
    const same = { baseVersion: 12, savedAt: new Date().toISOString(), data: structuredClone(server) };
    expect(shouldOfferDraft(same, server)).toBe(false);
    const changed = { ...same, data: { ...server, tables: [createTable('t', 'square', { x: 1, y: 1 }, 'Mesa 1')] } };
    expect(shouldOfferDraft(changed, server)).toBe(true);
    expect(shouldOfferDraft(null, server)).toBe(false);
  });

  it('the dialog text compares the draft base version with the server version', () => {
    const now = new Date();
    const savedAt = new Date(now.getTime() - 60 * 60 * 1000);
    const draft = { baseVersion: 12, savedAt: savedAt.toISOString(), data: createEmptyProject('Casamento') };
    writeDraft(draft);
    const read = readDraft();
    expect(read?.baseVersion).toBe(12);
    const text = t.draft.body(formatWhen(read?.savedAt ?? '', now), read?.baseVersion ?? 0, 13);
    expect(text).toContain('feitas sobre a versão 12');
    expect(text).toContain('A versão atual no servidor é a 13');
    expect(text).toContain('hoje às');
  });

  it('debounces writes and clears the draft', () => {
    vi.useFakeTimers();
    const data = createEmptyProject('Casamento');
    scheduleDraft(data, 12, 1000);
    expect(readDraft()).toBeNull();
    vi.advanceTimersByTime(1100);
    expect(readDraft()?.baseVersion).toBe(12);
    clearDraft();
    expect(readDraft()).toBeNull();
    vi.useRealTimers();
  });
});
