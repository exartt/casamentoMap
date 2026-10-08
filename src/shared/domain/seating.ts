import {
  COUPLE_TABLE_LABEL,
  RENUMBER_ROW_TOLERANCE_M,
  SEAT_SIDE_ORDER,
  TABLE_LABEL_PREFIX,
  TABLE_SPECS,
} from '../config/defaults';
import type { Guest, ProjectData, Seat, SeatSide, Table, TableKind } from './types';

export type SeatLocation = { tableId: string; seatIndex: number };

export type AssignResult =
  | { ok: true; project: ProjectData; seatIndex: number }
  | { ok: false; reason: 'tableFull' | 'seatDisabled' | 'seatOccupied' | 'notFound' | 'overCapacity' };

export type TableOccupancy = { capacity: number; enabled: number; occupied: number; free: number };

/** Creates the seat array for a table kind, preserving state of existing seats by index. */
export function buildSeats(kind: TableKind, existing: Seat[] = []): Seat[] {
  const spec = TABLE_SPECS[kind];
  const seats: Seat[] = [];
  let index = 0;
  for (const side of SEAT_SIDE_ORDER) {
    for (let i = 0; i < spec.seatsPerSide[side]; i += 1) {
      const prev = existing[index];
      seats.push({
        index,
        side,
        enabled: prev ? prev.enabled : true,
        guestId: prev ? prev.guestId : null,
      });
      index += 1;
    }
  }
  return seats;
}

/** Creates a new table of the given kind centered at the position. */
export function createTable(
  id: string,
  kind: TableKind,
  position: { x: number; y: number },
  label: string,
  options: Partial<Pick<Table, 'highlight' | 'rotation' | 'widthM' | 'depthM'>> = {},
): Table {
  const spec = TABLE_SPECS[kind];
  return {
    id,
    kind,
    label,
    x: position.x,
    y: position.y,
    rotation: options.rotation ?? 0,
    widthM: options.widthM ?? spec.defaultWidthM,
    depthM: options.depthM ?? spec.defaultDepthM,
    seats: buildSeats(kind),
    highlight: options.highlight ?? false,
    locked: false,
  };
}

/** Creates the couple's banquet table with the standard label and highlight. */
export function createCoupleTable(id: string, position: { x: number; y: number }): Table {
  return createTable(id, 'banquet', position, COUPLE_TABLE_LABEL, { highlight: true });
}

/** Returns the next automatic table label ("Mesa N"), N being one above the highest numbered label. */
export function nextTableLabel(tables: Table[]): string {
  let max = 0;
  const pattern = new RegExp(`^${TABLE_LABEL_PREFIX}\\s+(\\d+)$`, 'i');
  for (const t of tables) {
    const match = pattern.exec(t.label.trim());
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `${TABLE_LABEL_PREFIX} ${max + 1}`;
}

/** Renumbers tables in reading order (top to bottom, left to right), skipping highlighted tables. */
export function renumberTables(tables: Table[]): Table[] {
  const ordered = [...tables].sort((a, b) => a.y - b.y);
  const rows: Table[][] = [];
  for (const t of ordered) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(t.y - row[0].y) <= RENUMBER_ROW_TOLERANCE_M) row.push(t);
    else rows.push([t]);
  }
  const labels = new Map<string, string>();
  let n = 1;
  for (const row of rows) {
    row.sort((a, b) => a.x - b.x);
    for (const t of row) {
      if (t.highlight) continue;
      labels.set(t.id, `${TABLE_LABEL_PREFIX} ${n}`);
      n += 1;
    }
  }
  return tables.map((t) => (labels.has(t.id) ? { ...t, label: labels.get(t.id) as string } : t));
}

/** Builds a map from guest id to the seat where the guest sits. */
export function guestSeatMap(project: Pick<ProjectData, 'tables'>): Map<string, SeatLocation> {
  const map = new Map<string, SeatLocation>();
  for (const table of project.tables) {
    for (const seat of table.seats) {
      if (seat.guestId) map.set(seat.guestId, { tableId: table.id, seatIndex: seat.index });
    }
  }
  return map;
}

/** Computes capacity, enabled, occupied and free seats of a table. */
export function tableOccupancy(table: Table): TableOccupancy {
  const capacity = TABLE_SPECS[table.kind].capacity;
  let enabled = 0;
  let occupied = 0;
  for (const seat of table.seats) {
    if (seat.enabled) enabled += 1;
    if (seat.guestId && seat.enabled) occupied += 1;
  }
  return { capacity, enabled, occupied, free: enabled - occupied };
}

/** Returns the first enabled and empty seat index of a table, or null. */
export function firstFreeSeat(table: Table): number | null {
  const seat = table.seats.find((s) => s.enabled && s.guestId === null);
  return seat ? seat.index : null;
}

function replaceTable(project: ProjectData, table: Table): ProjectData {
  return { ...project, tables: project.tables.map((t) => (t.id === table.id ? table : t)) };
}

/** Removes the guest from any seat in the project. */
export function unassignGuest(project: ProjectData, guestId: string): ProjectData {
  let changed = false;
  const tables = project.tables.map((table) => {
    if (!table.seats.some((s) => s.guestId === guestId)) return table;
    changed = true;
    return { ...table, seats: table.seats.map((s) => (s.guestId === guestId ? { ...s, guestId: null } : s)) };
  });
  return changed ? { ...project, tables } : project;
}

/** Seats a guest at a specific seat; the guest leaves any other seat first. */
export function assignGuestToSeat(project: ProjectData, tableId: string, seatIndex: number, guestId: string): AssignResult {
  const table = project.tables.find((t) => t.id === tableId);
  if (!table) return { ok: false, reason: 'notFound' };
  if (!project.guests.some((g) => g.id === guestId)) return { ok: false, reason: 'notFound' };
  const seat = table.seats[seatIndex];
  if (!seat) return { ok: false, reason: 'notFound' };
  if (!seat.enabled) return { ok: false, reason: 'seatDisabled' };
  if (seat.guestId && seat.guestId !== guestId) return { ok: false, reason: 'seatOccupied' };
  const cleared = unassignGuest(project, guestId);
  const target = cleared.tables.find((t) => t.id === tableId) as Table;
  const occupancy = tableOccupancy(target);
  if (occupancy.occupied >= occupancy.capacity) return { ok: false, reason: 'overCapacity' };
  const updated: Table = {
    ...target,
    seats: target.seats.map((s) => (s.index === seatIndex ? { ...s, guestId } : s)),
  };
  return { ok: true, project: replaceTable(cleared, updated), seatIndex };
}

/** Seats a guest at the first free seat of a table. */
export function assignGuestToTable(project: ProjectData, tableId: string, guestId: string): AssignResult {
  const table = project.tables.find((t) => t.id === tableId);
  if (!table) return { ok: false, reason: 'notFound' };
  const current = table.seats.find((s) => s.guestId === guestId);
  if (current) return { ok: true, project, seatIndex: current.index };
  const free = firstFreeSeat(table);
  if (free === null) return { ok: false, reason: 'tableFull' };
  return assignGuestToSeat(project, tableId, free, guestId);
}

/** Swaps the occupants of two seats (either may be empty). */
export function swapSeats(project: ProjectData, a: SeatLocation, b: SeatLocation): ProjectData {
  const tableA = project.tables.find((t) => t.id === a.tableId);
  const tableB = project.tables.find((t) => t.id === b.tableId);
  if (!tableA || !tableB) return project;
  const seatA = tableA.seats[a.seatIndex];
  const seatB = tableB.seats[b.seatIndex];
  if (!seatA || !seatB || !seatA.enabled || !seatB.enabled) return project;
  const guestA = seatA.guestId;
  const guestB = seatB.guestId;
  const tables = project.tables.map((table) => {
    if (table.id !== a.tableId && table.id !== b.tableId) return table;
    return {
      ...table,
      seats: table.seats.map((s) => {
        if (table.id === a.tableId && s.index === a.seatIndex) return { ...s, guestId: guestB };
        if (table.id === b.tableId && s.index === b.seatIndex) return { ...s, guestId: guestA };
        return s;
      }),
    };
  });
  return { ...project, tables };
}

/** Enables or disables a seat; disabling frees its occupant. */
export function setSeatEnabled(project: ProjectData, tableId: string, seatIndex: number, enabled: boolean): ProjectData {
  const table = project.tables.find((t) => t.id === tableId);
  if (!table) return project;
  const updated: Table = {
    ...table,
    seats: table.seats.map((s) =>
      s.index === seatIndex ? { ...s, enabled, guestId: enabled ? s.guestId : null } : s,
    ),
  };
  return replaceTable(project, updated);
}

/** Frees every seat of a table. */
export function emptyTable(project: ProjectData, tableId: string): ProjectData {
  const table = project.tables.find((t) => t.id === tableId);
  if (!table) return project;
  return replaceTable(project, { ...table, seats: table.seats.map((s) => ({ ...s, guestId: null })) });
}

/** Removes tables; their guests become unseated automatically. */
export function removeTables(project: ProjectData, tableIds: string[]): ProjectData {
  const ids = new Set(tableIds);
  return { ...project, tables: project.tables.filter((t) => !ids.has(t.id)) };
}

/** Copies a table keeping kind, size, rotation and enabled seats, without guests. */
export function duplicateTable(table: Table, newId: string, label: string, offset: { x: number; y: number }): Table {
  return {
    ...table,
    id: newId,
    label,
    x: table.x + offset.x,
    y: table.y + offset.y,
    highlight: false,
    locked: false,
    seats: table.seats.map((s) => ({ ...s, guestId: null })),
  };
}

/** Changes the kind of a table, rebuilding seats and freeing guests that no longer fit. */
export function changeTableKind(table: Table, kind: TableKind): Table {
  if (table.kind === kind) return table;
  const spec = TABLE_SPECS[kind];
  return {
    ...table,
    kind,
    widthM: spec.defaultWidthM,
    depthM: spec.defaultDepthM,
    seats: buildSeats(kind, []),
  };
}

/** Removes guests from the list and frees their seats. */
export function removeGuests(project: ProjectData, guestIds: string[]): ProjectData {
  const ids = new Set(guestIds);
  const guests = project.guests.filter((g) => !ids.has(g.id));
  const tables = project.tables.map((table) => {
    if (!table.seats.some((s) => s.guestId && ids.has(s.guestId))) return table;
    return { ...table, seats: table.seats.map((s) => (s.guestId && ids.has(s.guestId) ? { ...s, guestId: null } : s)) };
  });
  return { ...project, guests, tables };
}

/** Adds or replaces a guest in the list. */
export function upsertGuest(project: ProjectData, guest: Guest): ProjectData {
  const exists = project.guests.some((g) => g.id === guest.id);
  const guests = exists ? project.guests.map((g) => (g.id === guest.id ? guest : g)) : [...project.guests, guest];
  return { ...project, guests };
}

/** Counts of seats and guests used by the status bar. */
export function projectCounters(project: ProjectData): {
  guests: number;
  seated: number;
  unseated: number;
  tables: number;
  enabledSeats: number;
  freeSeats: number;
} {
  const seatMap = guestSeatMap(project);
  let enabledSeats = 0;
  let freeSeats = 0;
  for (const table of project.tables) {
    const occ = tableOccupancy(table);
    enabledSeats += occ.enabled;
    freeSeats += occ.free;
  }
  const seated = project.guests.filter((g) => seatMap.has(g.id)).length;
  return {
    guests: project.guests.length,
    seated,
    unseated: project.guests.length - seated,
    tables: project.tables.length,
    enabledSeats,
    freeSeats,
  };
}

/** Returns the side of a seat index for a table kind. */
export function seatSide(kind: TableKind, index: number): SeatSide {
  const spec = TABLE_SPECS[kind];
  let i = 0;
  for (const side of SEAT_SIDE_ORDER) {
    i += spec.seatsPerSide[side];
    if (index < i) return side;
  }
  return 'top';
}

/** Finds a table by its label or by its number ("7" matches "Mesa 7"), ignoring case. */
export function findTableByLabel(tables: Table[], text: string): Table | undefined {
  const needle = text.trim().toLowerCase();
  if (needle === '') return undefined;
  const direct = tables.find((t) => t.label.trim().toLowerCase() === needle);
  if (direct) return direct;
  if (/^\d+$/.test(needle)) {
    return tables.find((t) => t.label.trim().toLowerCase() === `${TABLE_LABEL_PREFIX.toLowerCase()} ${Number(needle)}`);
  }
  return undefined;
}
