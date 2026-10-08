import { describe, expect, it } from 'vitest';
import { createEmptyProject } from '@shared/domain/projectMigration';
import {
  assignGuestToSeat,
  assignGuestToTable,
  createTable,
  guestSeatMap,
  nextTableLabel,
  removeTables,
  renumberTables,
  setSeatEnabled,
  swapSeats,
  tableOccupancy,
} from '@shared/domain/seating';
import type { ProjectData } from '@shared/domain/types';

function project(): ProjectData {
  const p = createEmptyProject('Teste');
  p.tables = [createTable('t1', 'banquet', { x: 5, y: 5 }, 'Mesa 1'), createTable('t2', 'square', { x: 10, y: 5 }, 'Mesa 2')];
  p.guests = Array.from({ length: 12 }, (_, i) => ({ id: `g${i + 1}`, name: `Convidado ${i + 1}` }));
  return p;
}

describe('seating', () => {
  it('refuses the 11th guest on a banquet table', () => {
    let p = project();
    for (let i = 1; i <= 10; i += 1) {
      const r = assignGuestToTable(p, 't1', `g${i}`);
      expect(r.ok).toBe(true);
      if (r.ok) p = r.project;
    }
    const r = assignGuestToTable(p, 't1', 'g11');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('tableFull');
    expect(tableOccupancy(p.tables[0]).occupied).toBe(10);
  });

  it('keeps a guest in a single seat', () => {
    let p = project();
    let r = assignGuestToSeat(p, 't1', 0, 'g1');
    if (r.ok) p = r.project;
    r = assignGuestToSeat(p, 't2', 3, 'g1');
    if (r.ok) p = r.project;
    const seats = p.tables.flatMap((t) => t.seats).filter((s) => s.guestId === 'g1');
    expect(seats).toHaveLength(1);
    expect(guestSeatMap(p).get('g1')).toEqual({ tableId: 't2', seatIndex: 3 });
  });

  it('frees guests when a table is removed', () => {
    let p = project();
    const r = assignGuestToTable(p, 't1', 'g1');
    if (r.ok) p = r.project;
    p = removeTables(p, ['t1']);
    expect(guestSeatMap(p).has('g1')).toBe(false);
    expect(p.guests.some((g) => g.id === 'g1')).toBe(true);
  });

  it('disabling an occupied seat frees the guest', () => {
    let p = project();
    const r = assignGuestToSeat(p, 't1', 2, 'g1');
    if (r.ok) p = r.project;
    p = setSeatEnabled(p, 't1', 2, false);
    expect(p.tables[0].seats[2].enabled).toBe(false);
    expect(p.tables[0].seats[2].guestId).toBeNull();
    const again = assignGuestToSeat(p, 't1', 2, 'g2');
    expect(again.ok).toBe(false);
  });

  it('swaps two seats', () => {
    let p = project();
    let r = assignGuestToSeat(p, 't1', 0, 'g1');
    if (r.ok) p = r.project;
    r = assignGuestToSeat(p, 't2', 1, 'g2');
    if (r.ok) p = r.project;
    p = swapSeats(p, { tableId: 't1', seatIndex: 0 }, { tableId: 't2', seatIndex: 1 });
    expect(guestSeatMap(p).get('g1')).toEqual({ tableId: 't2', seatIndex: 1 });
    expect(guestSeatMap(p).get('g2')).toEqual({ tableId: 't1', seatIndex: 0 });
  });

  it('numbers new tables after the highest existing number', () => {
    const p = project();
    expect(nextTableLabel(p.tables)).toBe('Mesa 3');
    expect(nextTableLabel(p.tables.filter((t) => t.id !== 't1'))).toBe('Mesa 3');
  });

  it('renumbers in reading order', () => {
    const tables = [
      createTable('a', 'square', { x: 10, y: 8 }, 'Mesa 1'),
      createTable('b', 'square', { x: 2, y: 2 }, 'Mesa 2'),
      createTable('c', 'square', { x: 8, y: 2.3 }, 'Mesa 3'),
    ];
    const renumbered = renumberTables(tables);
    expect(renumbered.find((t) => t.id === 'b')?.label).toBe('Mesa 1');
    expect(renumbered.find((t) => t.id === 'c')?.label).toBe('Mesa 2');
    expect(renumbered.find((t) => t.id === 'a')?.label).toBe('Mesa 3');
  });
});
