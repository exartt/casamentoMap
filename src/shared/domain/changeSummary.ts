import { guestSeatMap } from './seating';
import { joinPt, plural } from './text';
import type { Door, Fixture, Guest, ProjectData, Table } from './types';

export type ChangeCounts = {
  tablesAdded: number;
  tablesRemoved: number;
  tablesMoved: number;
  tablesEdited: number;
  fixturesAdded: number;
  fixturesRemoved: number;
  fixturesChanged: number;
  doorsAdded: number;
  doorsRemoved: number;
  doorsChanged: number;
  guestsAdded: number;
  guestsRemoved: number;
  guestsEdited: number;
  seated: number;
  unseated: number;
  reseated: number;
  venueChanged: boolean;
  settingsChanged: boolean;
  nameChanged: boolean;
};

const POSITION_EPSILON = 1e-6;

function positionChanged(a: { x: number; y: number; rotation: number }, b: { x: number; y: number; rotation: number }): boolean {
  return (
    Math.abs(a.x - b.x) > POSITION_EPSILON ||
    Math.abs(a.y - b.y) > POSITION_EPSILON ||
    Math.abs(a.rotation - b.rotation) > POSITION_EPSILON
  );
}

function tableEdited(a: Table, b: Table): boolean {
  if (a.kind !== b.kind || a.label !== b.label || a.widthM !== b.widthM || a.depthM !== b.depthM) return true;
  if (a.highlight !== b.highlight || a.locked !== b.locked || (a.notes ?? '') !== (b.notes ?? '')) return true;
  if (a.seats.length !== b.seats.length) return true;
  for (let i = 0; i < a.seats.length; i += 1) {
    if (a.seats[i].enabled !== b.seats[i].enabled) return true;
  }
  return false;
}

function fixtureChanged(a: Fixture, b: Fixture): boolean {
  return (
    positionChanged(a, b) ||
    a.kind !== b.kind ||
    a.label !== b.label ||
    a.shape !== b.shape ||
    a.widthM !== b.widthM ||
    a.depthM !== b.depthM ||
    a.color !== b.color ||
    a.blocksPlacement !== b.blocksPlacement ||
    a.locked !== b.locked
  );
}

function doorChanged(a: Door, b: Door): boolean {
  return a.kind !== b.kind || a.label !== b.label || a.wall !== b.wall || a.offsetM !== b.offsetM || a.widthM !== b.widthM;
}

function guestEdited(a: Guest, b: Guest): boolean {
  return (
    a.name !== b.name ||
    (a.group ?? '') !== (b.group ?? '') ||
    (a.side ?? '') !== (b.side ?? '') ||
    (a.isChild ?? false) !== (b.isChild ?? false) ||
    (a.dietary ?? '') !== (b.dietary ?? '') ||
    (a.notes ?? '') !== (b.notes ?? '')
  );
}

function byId<T extends { id: string }>(list: T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of list) map.set(item.id, item);
  return map;
}

/** Computes structured counts of what changed between two project documents. */
export function diffProjects(prev: ProjectData, next: ProjectData): ChangeCounts {
  const counts: ChangeCounts = {
    tablesAdded: 0,
    tablesRemoved: 0,
    tablesMoved: 0,
    tablesEdited: 0,
    fixturesAdded: 0,
    fixturesRemoved: 0,
    fixturesChanged: 0,
    doorsAdded: 0,
    doorsRemoved: 0,
    doorsChanged: 0,
    guestsAdded: 0,
    guestsRemoved: 0,
    guestsEdited: 0,
    seated: 0,
    unseated: 0,
    reseated: 0,
    venueChanged: prev.venue.widthM !== next.venue.widthM || prev.venue.depthM !== next.venue.depthM,
    settingsChanged: JSON.stringify(prev.settings) !== JSON.stringify(next.settings),
    nameChanged: prev.name !== next.name,
  };

  const prevTables = byId(prev.tables);
  const nextTables = byId(next.tables);
  for (const [id, table] of nextTables) {
    const before = prevTables.get(id);
    if (!before) counts.tablesAdded += 1;
    else if (positionChanged(before, table)) counts.tablesMoved += 1;
    else if (tableEdited(before, table)) counts.tablesEdited += 1;
  }
  for (const id of prevTables.keys()) if (!nextTables.has(id)) counts.tablesRemoved += 1;

  const prevFixtures = byId(prev.fixtures);
  const nextFixtures = byId(next.fixtures);
  for (const [id, fixture] of nextFixtures) {
    const before = prevFixtures.get(id);
    if (!before) counts.fixturesAdded += 1;
    else if (fixtureChanged(before, fixture)) counts.fixturesChanged += 1;
  }
  for (const id of prevFixtures.keys()) if (!nextFixtures.has(id)) counts.fixturesRemoved += 1;

  const prevDoors = byId(prev.doors);
  const nextDoors = byId(next.doors);
  for (const [id, door] of nextDoors) {
    const before = prevDoors.get(id);
    if (!before) counts.doorsAdded += 1;
    else if (doorChanged(before, door)) counts.doorsChanged += 1;
  }
  for (const id of prevDoors.keys()) if (!nextDoors.has(id)) counts.doorsRemoved += 1;

  const prevGuests = byId(prev.guests);
  const nextGuests = byId(next.guests);
  for (const [id, guest] of nextGuests) {
    const before = prevGuests.get(id);
    if (!before) counts.guestsAdded += 1;
    else if (guestEdited(before, guest)) counts.guestsEdited += 1;
  }
  for (const id of prevGuests.keys()) if (!nextGuests.has(id)) counts.guestsRemoved += 1;

  const prevSeats = guestSeatMap(prev);
  const nextSeats = guestSeatMap(next);
  for (const [guestId, loc] of nextSeats) {
    const before = prevSeats.get(guestId);
    if (!before) counts.seated += 1;
    else if (before.tableId !== loc.tableId || before.seatIndex !== loc.seatIndex) counts.reseated += 1;
  }
  for (const guestId of prevSeats.keys()) {
    if (!nextSeats.has(guestId) && nextGuests.has(guestId)) counts.unseated += 1;
  }

  return counts;
}

/** Formats change counts as a short pt-BR sentence. */
export function formatChangeSummary(c: ChangeCounts): string {
  const parts: string[] = [];
  if (c.tablesAdded) parts.push(plural(c.tablesAdded, 'mesa adicionada', 'mesas adicionadas'));
  if (c.tablesRemoved) parts.push(plural(c.tablesRemoved, 'mesa removida', 'mesas removidas'));
  if (c.tablesMoved) parts.push(plural(c.tablesMoved, 'mesa movida', 'mesas movidas'));
  if (c.tablesEdited) parts.push(plural(c.tablesEdited, 'mesa editada', 'mesas editadas'));
  const fixtures = c.fixturesAdded + c.fixturesRemoved + c.fixturesChanged;
  if (fixtures) parts.push(plural(fixtures, 'elemento alterado', 'elementos alterados'));
  const doors = c.doorsAdded + c.doorsRemoved + c.doorsChanged;
  if (doors) parts.push(plural(doors, 'porta alterada', 'portas alteradas'));
  if (c.guestsAdded) parts.push(plural(c.guestsAdded, 'convidado adicionado', 'convidados adicionados'));
  if (c.guestsRemoved) parts.push(plural(c.guestsRemoved, 'convidado removido', 'convidados removidos'));
  if (c.guestsEdited) parts.push(plural(c.guestsEdited, 'convidado editado', 'convidados editados'));
  if (c.seated) parts.push(plural(c.seated, 'convidado alocado', 'convidados alocados'));
  if (c.reseated) parts.push(plural(c.reseated, 'convidado mudou de lugar', 'convidados mudaram de lugar'));
  if (c.unseated) parts.push(plural(c.unseated, 'alocação desfeita', 'alocações desfeitas'));
  if (c.venueChanged) parts.push('medidas do salão alteradas');
  if (c.settingsChanged) parts.push('configurações alteradas');
  if (c.nameChanged) parts.push('nome do projeto alterado');
  return parts.length === 0 ? 'Sem alterações' : joinPt(parts);
}

/** Summarizes in pt-BR what changed from one version to the next. */
export function summarizeChanges(prev: ProjectData, next: ProjectData): string {
  return formatChangeSummary(diffProjects(prev, next));
}
