import { describe, expect, it } from 'vitest';
import { diffProjects, summarizeChanges } from '@shared/domain/changeSummary';
import { createEmptyProject } from '@shared/domain/projectMigration';
import { assignGuestToSeat, createTable } from '@shared/domain/seating';

function base() {
  const p = createEmptyProject('Teste');
  p.tables = [
    createTable('t1', 'banquet', { x: 5, y: 5 }, 'Mesa 1'),
    createTable('t2', 'square', { x: 10, y: 5 }, 'Mesa 2'),
    createTable('t3', 'square', { x: 14, y: 5 }, 'Mesa 3'),
  ];
  p.guests = Array.from({ length: 6 }, (_, i) => ({ id: `g${i + 1}`, name: `Convidado ${i + 1}` }));
  return p;
}

describe('changeSummary', () => {
  it('counts moved, added and removed tables', () => {
    const prev = base();
    const next = {
      ...prev,
      tables: [
        { ...prev.tables[0], x: 6 },
        { ...prev.tables[1], rotation: 90 },
        createTable('t4', 'square', { x: 2, y: 2 }, 'Mesa 4'),
      ],
    };
    const c = diffProjects(prev, next);
    expect(c.tablesMoved).toBe(2);
    expect(c.tablesAdded).toBe(1);
    expect(c.tablesRemoved).toBe(1);
    expect(summarizeChanges(prev, next)).toBe('1 mesa adicionada, 1 mesa removida e 2 mesas movidas');
  });

  it('counts guests and allocations', () => {
    const prev = base();
    let next = { ...prev, guests: [...prev.guests.slice(1), { id: 'g7', name: 'Novo' }, { id: 'g8', name: 'Nova' }] };
    for (let i = 0; i < 5; i += 1) {
      const r = assignGuestToSeat(next, 't1', i, `g${i + 2}`);
      if (r.ok) next = r.project;
    }
    const c = diffProjects(prev, next);
    expect(c.guestsAdded).toBe(2);
    expect(c.guestsRemoved).toBe(1);
    expect(c.seated).toBe(5);
    expect(summarizeChanges(prev, next)).toBe('2 convidados adicionados, 1 convidado removido e 5 convidados alocados');
  });

  it('counts undone and changed allocations', () => {
    let prev = base();
    let r = assignGuestToSeat(prev, 't1', 0, 'g1');
    if (r.ok) prev = r.project;
    r = assignGuestToSeat(prev, 't1', 1, 'g2');
    if (r.ok) prev = r.project;
    let next = prev;
    r = assignGuestToSeat(next, 't2', 0, 'g1');
    if (r.ok) next = r.project;
    next = { ...next, tables: next.tables.map((t) => ({ ...t, seats: t.seats.map((s) => (s.guestId === 'g2' ? { ...s, guestId: null } : s)) })) };
    const c = diffProjects(prev, next);
    expect(c.reseated).toBe(1);
    expect(c.unseated).toBe(1);
    expect(c.tablesMoved).toBe(0);
  });

  it('reports venue, fixture and door changes', () => {
    const prev = base();
    const next = {
      ...prev,
      venue: { widthM: 18.5, depthM: 11 },
      doors: [{ id: 'd1', kind: 'main' as const, label: 'Entrada', wall: 'top' as const, offsetM: 3, widthM: 1.2 }],
    };
    expect(summarizeChanges(prev, next)).toBe('1 porta alterada e medidas do salão alteradas');
    expect(summarizeChanges(prev, prev)).toBe('Sem alterações');
  });
});
