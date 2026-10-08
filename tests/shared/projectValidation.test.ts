import { describe, expect, it } from 'vitest';
import { createEmptyProject } from '@shared/domain/projectMigration';
import { validateProject } from '@shared/domain/projectValidation';
import { createTable } from '@shared/domain/seating';

function base() {
  const p = createEmptyProject('Teste');
  p.tables = [createTable('t1', 'banquet', { x: 5, y: 5 }, 'Mesa 1'), createTable('t2', 'square', { x: 10, y: 5 }, 'Mesa 2')];
  p.guests = [{ id: 'g1', name: 'Ana' }, { id: 'g2', name: 'Bruno' }];
  return p;
}

describe('validateProject', () => {
  it('accepts a valid document', () => {
    expect(validateProject(base()).ok).toBe(true);
  });

  it('rejects a guest in two seats', () => {
    const p = base();
    p.tables[0].seats[0].guestId = 'g1';
    p.tables[1].seats[0].guestId = 'g1';
    const r = validateProject(p);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problems.some((m) => m.includes('dois assentos'))).toBe(true);
  });

  it('rejects a table above capacity', () => {
    const p = base();
    p.tables[0].seats.push({ index: 10, side: 'top', enabled: true, guestId: null });
    const r = validateProject(p);
    expect(r.ok).toBe(false);
  });

  it('rejects an occupied disabled seat', () => {
    const p = base();
    p.tables[0].seats[0] = { ...p.tables[0].seats[0], enabled: false, guestId: 'g1' };
    const r = validateProject(p);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problems.some((m) => m.includes('desativado'))).toBe(true);
  });

  it('rejects an unknown guestId', () => {
    const p = base();
    p.tables[0].seats[0].guestId = 'nope';
    const r = validateProject(p);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problems.some((m) => m.includes('inexistente'))).toBe(true);
  });

  it('rejects an invalid schema', () => {
    const r = validateProject({ name: 'x' });
    expect(r.ok).toBe(false);
  });
});
