import {
  DEFAULT_DOOR_WIDTH_M,
  DOOR_SPECS,
  FIXTURE_SPECS,
  KEYBOARD_ROTATE_STEP_DEG,
} from '@shared/config/defaults';
import {
  clampDoorOffset,
  clampFixtureIntoVenue,
  clampTableIntoVenue,
  normalizeAngle,
  wallLength,
} from '@shared/domain/geometry';
import { elementOverlaps, elementsOutsideVenue } from '@shared/domain/layoutValidation';
import {
  assignGuestToSeat,
  assignGuestToTable,
  changeTableKind,
  createCoupleTable,
  createTable,
  duplicateTable,
  emptyTable,
  nextTableLabel,
  removeGuests,
  removeTables,
  renumberTables,
  setSeatEnabled,
  swapSeats,
  tableOccupancy,
  unassignGuest,
  upsertGuest,
} from '@shared/domain/seating';
import type { Door, DoorKind, ElementRef, Fixture, FixtureKind, Guest, ProjectData, Table, TableKind, Venue } from '@shared/domain/types';
import { round2, snapPosition } from '../components/canvas/canvasUtils';
import { t } from '../i18n/strings';
import { confirmDialog } from './confirmStore';
import { getDerived } from './derived';
import { useProjectStore } from './projectStore';
import { toastError, toastInfo, toastSuccess } from './toastStore';
import { useUiStore } from './uiStore';

const DUPLICATE_OFFSET_M = 0.5;

const FREE_SPOT_STEP_M = 1;

const FREE_SPOT_MAX_RING = 8;

/** Finds a nearby position where the candidate element does not overlap others, searching in rings around the origin. */
function findFreePosition(p: ProjectData, origin: { x: number; y: number }, build: (pos: { x: number; y: number }) => ProjectData, id: string, type: 'table' | 'fixture'): { x: number; y: number } {
  const fits = (pos: { x: number; y: number }) => !elementOverlaps(build(pos), { type, id });
  if (fits(origin)) return origin;
  for (let ring = 1; ring <= FREE_SPOT_MAX_RING; ring += 1) {
    const d = ring * FREE_SPOT_STEP_M;
    const candidates: Array<{ x: number; y: number }> = [];
    for (let i = -ring; i <= ring; i += 1) {
      candidates.push({ x: origin.x + i * FREE_SPOT_STEP_M, y: origin.y - d });
      candidates.push({ x: origin.x + i * FREE_SPOT_STEP_M, y: origin.y + d });
      candidates.push({ x: origin.x - d, y: origin.y + i * FREE_SPOT_STEP_M });
      candidates.push({ x: origin.x + d, y: origin.y + i * FREE_SPOT_STEP_M });
    }
    for (const c of candidates) {
      if (c.x < 0 || c.y < 0 || c.x > p.venue.widthM || c.y > p.venue.depthM) continue;
      if (fits(c)) return c;
    }
  }
  return origin;
}

function project(): ProjectData {
  const p = useProjectStore.getState().project;
  if (!p) throw new Error('Projeto não carregado');
  return p;
}

function commit(updater: (p: ProjectData) => ProjectData, coalesceKey?: string): void {
  useProjectStore.getState().commit(updater, coalesceKey ? { coalesceKey } : undefined);
}

/** Resolves which kind of element an id refers to. */
export function refOf(id: string, p: ProjectData = project()): ElementRef | null {
  const d = getDerived(p);
  if (d.tablesById.has(id)) return { type: 'table', id };
  if (d.fixturesById.has(id)) return { type: 'fixture', id };
  if (d.doorsById.has(id)) return { type: 'door', id };
  return null;
}

/** Adds a table of the given kind centered at the position; returns its id. */
export function addTable(kind: TableKind, position: { x: number; y: number }, couple = false): string {
  const id = crypto.randomUUID();
  commit((p) => {
    const snapped = snapPosition(position, p.settings);
    const base = couple ? createCoupleTable(id, snapped) : createTable(id, kind, snapped, nextTableLabel(p.tables));
    const withTable = (pos: { x: number; y: number }) => ({ ...p, tables: [...p.tables, { ...base, ...clampTableIntoVenue({ ...base, ...pos }, p.venue) }] });
    const free = findFreePosition(p, snapped, withTable, id, 'table');
    return withTable(snapPosition(free, p.settings));
  });
  useProjectStore.getState().setSelection([id]);
  return id;
}

/** Adds a fixture of the given kind centered at the position; returns its id. */
export function addFixture(kind: FixtureKind, position: { x: number; y: number }): string {
  const id = crypto.randomUUID();
  const spec = FIXTURE_SPECS[kind];
  commit((p) => {
    const snapped = snapPosition(position, p.settings);
    const sameKind = p.fixtures.filter((f) => f.kind === kind).length;
    const fixture: Fixture = {
      id,
      kind,
      label: sameKind > 0 ? `${spec.labelPt} ${sameKind + 1}` : spec.labelPt,
      shape: spec.shape,
      x: snapped.x,
      y: snapped.y,
      rotation: 0,
      widthM: spec.defaultWidthM,
      depthM: spec.defaultDepthM,
      color: spec.color,
      blocksPlacement: true,
      locked: false,
    };
    const withFixture = (pos: { x: number; y: number }) => ({ ...p, fixtures: [...p.fixtures, { ...fixture, ...clampFixtureIntoVenue({ ...fixture, ...pos }, p.venue) }] });
    const free = findFreePosition(p, snapped, withFixture, id, 'fixture');
    return withFixture(snapPosition(free, p.settings));
  });
  useProjectStore.getState().setSelection([id]);
  return id;
}

/** Adds a door on the wall nearest to the position (or the top wall); returns its id. */
export function addDoor(kind: DoorKind, placement?: { wall: Door['wall']; offsetM: number }): string {
  const id = crypto.randomUUID();
  commit((p) => {
    const sameKind = p.doors.filter((d) => d.kind === kind).length;
    const base: Door = {
      id,
      kind,
      label: sameKind > 0 ? `${DOOR_SPECS[kind].labelPt} ${sameKind + 1}` : DOOR_SPECS[kind].labelPt,
      wall: placement?.wall ?? 'top',
      offsetM: placement?.offsetM ?? wallLength('top', p.venue) / 2,
      widthM: DEFAULT_DOOR_WIDTH_M,
    };
    return { ...p, doors: [...p.doors, { ...base, offsetM: round2(clampDoorOffset(base, base.offsetM, p.venue)) }] };
  });
  useProjectStore.getState().setSelection([id]);
  return id;
}

/** Applies a partial update to a table (seats are rebuilt when the kind changes). */
export function updateTable(id: string, patch: Partial<Omit<Table, 'id' | 'seats'>>, coalesceKey?: string): void {
  commit((p) => {
    const table = p.tables.find((x) => x.id === id);
    if (!table) return p;
    let next: Table = { ...table, ...patch };
    if (patch.kind && patch.kind !== table.kind) next = changeTableKind(table, patch.kind);
    if (patch.rotation !== undefined) next.rotation = normalizeAngle(patch.rotation);
    return { ...p, tables: p.tables.map((x) => (x.id === id ? next : x)) };
  }, coalesceKey);
}

/** Applies a partial update to a fixture. */
export function updateFixture(id: string, patch: Partial<Omit<Fixture, 'id'>>, coalesceKey?: string): void {
  commit((p) => {
    const fixture = p.fixtures.find((x) => x.id === id);
    if (!fixture) return p;
    const next: Fixture = { ...fixture, ...patch };
    if (next.shape === 'circle') next.depthM = next.widthM;
    if (patch.rotation !== undefined) next.rotation = normalizeAngle(patch.rotation);
    return { ...p, fixtures: p.fixtures.map((x) => (x.id === id ? next : x)) };
  }, coalesceKey);
}

/** Applies a partial update to a door, keeping it within its wall. */
export function updateDoor(id: string, patch: Partial<Omit<Door, 'id'>>, coalesceKey?: string): void {
  commit((p) => {
    const door = p.doors.find((x) => x.id === id);
    if (!door) return p;
    const next: Door = { ...door, ...patch };
    next.offsetM = round2(clampDoorOffset(next, next.offsetM, p.venue));
    return { ...p, doors: p.doors.map((x) => (x.id === id ? next : x)) };
  }, coalesceKey);
}

/** Updates the project settings. */
export function updateSettings(patch: Partial<ProjectData['settings']>): void {
  commit((p) => ({ ...p, settings: { ...p.settings, ...patch } }));
}

/** Renames the project. */
export function renameProject(name: string): void {
  commit((p) => ({ ...p, name }), 'project-name');
}

export type PositionUpdate = { id: string; x: number; y: number; rotation?: number };

/** Commits new positions after a drag; with "prevent overlap" on, overlapping elements keep their previous position. */
export function commitPositions(updates: PositionUpdate[]): { reverted: string[] } {
  const reverted: string[] = [];
  commit((p) => {
    let next = p;
    for (const u of updates) {
      const ref = refOf(u.id, p);
      if (!ref || ref.type === 'door') continue;
      const candidate = applyPosition(next, ref, u);
      if (p.settings.preventOverlap && elementOverlaps(candidate, ref) && !elementOverlaps(p, ref)) {
        reverted.push(u.id);
        continue;
      }
      next = candidate;
    }
    return next;
  });
  return { reverted };
}

function applyPosition(p: ProjectData, ref: ElementRef, u: PositionUpdate): ProjectData {
  if (ref.type === 'table') {
    return {
      ...p,
      tables: p.tables.map((x) =>
        x.id === u.id ? { ...x, x: round2(u.x), y: round2(u.y), rotation: u.rotation === undefined ? x.rotation : normalizeAngle(u.rotation) } : x,
      ),
    };
  }
  return {
    ...p,
    fixtures: p.fixtures.map((x) =>
      x.id === u.id ? { ...x, x: round2(u.x), y: round2(u.y), rotation: u.rotation === undefined ? x.rotation : normalizeAngle(u.rotation) } : x,
    ),
  };
}

/** Commits a door placement after a drag along the walls. */
export function commitDoorPlacement(id: string, wall: Door['wall'], offsetM: number): void {
  updateDoor(id, { wall, offsetM });
}

/** Moves the given elements by a delta in meters (keyboard arrows). */
export function nudgeElements(ids: string[], dx: number, dy: number): void {
  commit((p) => {
    const set = new Set(ids);
    return {
      ...p,
      tables: p.tables.map((x) => (set.has(x.id) && !x.locked ? { ...x, x: round2(x.x + dx), y: round2(x.y + dy) } : x)),
      fixtures: p.fixtures.map((x) => (set.has(x.id) && !x.locked ? { ...x, x: round2(x.x + dx), y: round2(x.y + dy) } : x)),
      doors: p.doors.map((d) => {
        if (!set.has(d.id)) return d;
        const delta = d.wall === 'top' || d.wall === 'bottom' ? dx : dy;
        return { ...d, offsetM: round2(clampDoorOffset(d, d.offsetM + delta, p.venue)) };
      }),
    };
  }, `nudge:${ids.join(',')}`);
}

/** Rotates the given tables and fixtures by a step (keyboard R). */
export function rotateElements(ids: string[], deltaDeg = KEYBOARD_ROTATE_STEP_DEG): void {
  commit((p) => {
    const set = new Set(ids);
    return {
      ...p,
      tables: p.tables.map((x) => (set.has(x.id) && !x.locked ? { ...x, rotation: normalizeAngle(x.rotation + deltaDeg) } : x)),
      fixtures: p.fixtures.map((x) => (set.has(x.id) && !x.locked ? { ...x, rotation: normalizeAngle(x.rotation + deltaDeg) } : x)),
    };
  });
}

/** Deletes elements after asking for confirmation when tables have guests. */
export async function deleteElements(ids: string[]): Promise<void> {
  const p = project();
  const d = getDerived(p);
  const tables = ids.map((id) => d.tablesById.get(id)).filter((x): x is Table => x !== undefined);
  const fixtures = ids.map((id) => d.fixturesById.get(id)).filter((x): x is Fixture => x !== undefined);
  const doors = ids.map((id) => d.doorsById.get(id)).filter((x): x is Door => x !== undefined);
  if (tables.length + fixtures.length + doors.length === 0) return;
  const seated = tables.reduce((sum, x) => sum + tableOccupancy(x).occupied, 0);
  let message: string;
  if (tables.length === 1 && fixtures.length === 0 && doors.length === 0) message = t.table.removeConfirm(tables[0].label, seated);
  else if (fixtures.length === 1 && tables.length === 0 && doors.length === 0) message = t.fixture.removeConfirm(fixtures[0].label);
  else if (doors.length === 1 && tables.length === 0 && fixtures.length === 0) message = t.door.removeConfirm(doors[0].label);
  else message = seated > 0 ? `Excluir ${ids.length} elementos? ${seated} convidado(s) voltarão para "Sem lugar".` : `Excluir ${ids.length} elementos?`;
  const ok = await confirmDialog({ message, confirmLabel: t.app.remove, destructive: true });
  if (!ok) return;
  const set = new Set(ids);
  commit((cur) => ({
    ...removeTables(cur, ids),
    fixtures: cur.fixtures.filter((x) => !set.has(x.id)),
    doors: cur.doors.filter((x) => !set.has(x.id)),
  }));
  useProjectStore.getState().clearSelection();
}

/** Duplicates the selected tables and fixtures with a small offset; selects the copies. */
export function duplicateElements(ids: string[]): void {
  const newIds: string[] = [];
  commit((p) => {
    const set = new Set(ids);
    let tables = p.tables;
    let fixtures = p.fixtures;
    for (const table of p.tables) {
      if (!set.has(table.id)) continue;
      const id = crypto.randomUUID();
      newIds.push(id);
      const copy = duplicateTable(table, id, nextTableLabel(tables), { x: DUPLICATE_OFFSET_M, y: DUPLICATE_OFFSET_M });
      tables = [...tables, { ...copy, ...clampTableIntoVenue(copy, p.venue) }];
    }
    for (const fixture of p.fixtures) {
      if (!set.has(fixture.id)) continue;
      const id = crypto.randomUUID();
      newIds.push(id);
      const copy: Fixture = { ...fixture, id, locked: false, x: fixture.x + DUPLICATE_OFFSET_M, y: fixture.y + DUPLICATE_OFFSET_M };
      fixtures = [...fixtures, { ...copy, ...clampFixtureIntoVenue(copy, p.venue) }];
    }
    return { ...p, tables, fixtures };
  });
  if (newIds.length > 0) useProjectStore.getState().setSelection(newIds);
}

/** Seats a guest at a table (first free seat) or a specific seat, offering a swap when the seat is taken. */
export async function seatGuest(guestId: string, tableId: string, seatIndex: number | null): Promise<boolean> {
  const p = project();
  const d = getDerived(p);
  const guest = d.guestsById.get(guestId);
  const table = d.tablesById.get(tableId);
  if (!guest || !table) return false;
  if (seatIndex === null) {
    const result = assignGuestToTable(p, tableId, guestId);
    if (!result.ok) {
      flashRefusal(tableId, t.table.fullMessage(table.label));
      return false;
    }
    commit(() => result.project);
    toastSuccess(t.toasts.guestSeated(guest.name, table.label));
    return true;
  }
  const seat = table.seats[seatIndex];
  if (!seat || !seat.enabled) {
    flashRefusal(tableId, t.toasts.seatDisabled);
    return false;
  }
  if (seat.guestId && seat.guestId !== guestId) {
    const occupant = d.guestsById.get(seat.guestId);
    const ok = await confirmDialog({
      message: t.table.swapConfirm(guest.name, occupant ? occupant.name : '?'),
      confirmLabel: t.app.confirm,
    });
    if (!ok) return false;
    const current = d.seatMap.get(guestId);
    commit((cur) => {
      if (current) return swapSeats(cur, current, { tableId, seatIndex });
      const freed = unassignGuest(cur, seat.guestId as string);
      const r = assignGuestToSeat(freed, tableId, seatIndex, guestId);
      return r.ok ? r.project : cur;
    });
    toastSuccess(t.toasts.swapped);
    return true;
  }
  const result = assignGuestToSeat(p, tableId, seatIndex, guestId);
  if (!result.ok) {
    flashRefusal(tableId, result.reason === 'overCapacity' || result.reason === 'tableFull' ? t.table.fullMessage(table.label) : t.toasts.seatDisabled);
    return false;
  }
  commit(() => result.project);
  toastSuccess(t.toasts.guestSeated(guest.name, table.label));
  return true;
}

function flashRefusal(tableId: string, message: string): void {
  const ui = useUiStore.getState();
  ui.flashTable(tableId);
  setTimeout(() => {
    if (useUiStore.getState().flashTableId === tableId) useUiStore.getState().flashTable(null);
  }, 700);
  toastError(message);
}

/** Removes a guest from the seat, keeping the guest in the list. */
export function unseatGuest(guestId: string): void {
  const guest = getDerived(project()).guestsById.get(guestId);
  commit((p) => unassignGuest(p, guestId));
  if (guest) toastInfo(t.toasts.guestRemoved(guest.name));
}

/** Swaps two seats directly (both may be empty). */
export function swapSeatOccupants(a: { tableId: string; seatIndex: number }, b: { tableId: string; seatIndex: number }): void {
  commit((p) => swapSeats(p, a, b));
}

/** Enables or disables a seat, confirming when it is occupied. */
export async function toggleSeat(tableId: string, seatIndex: number, enabled: boolean): Promise<void> {
  const p = project();
  const table = getDerived(p).tablesById.get(tableId);
  if (!table) return;
  const seat = table.seats[seatIndex];
  if (!seat) return;
  if (!enabled && seat.guestId) {
    const occupant = getDerived(p).guestsById.get(seat.guestId);
    const ok = await confirmDialog({ message: t.table.disableOccupiedConfirm(occupant ? occupant.name : '?'), confirmLabel: t.table.disableSeat, destructive: true });
    if (!ok) return;
  }
  commit((cur) => setSeatEnabled(cur, tableId, seatIndex, enabled));
}

/** Frees every seat of a table after confirmation. */
export async function emptyTableGuests(tableId: string): Promise<void> {
  const table = getDerived(project()).tablesById.get(tableId);
  if (!table) return;
  if (tableOccupancy(table).occupied === 0) return;
  const ok = await confirmDialog({ message: t.table.emptyTableConfirm(table.label), confirmLabel: t.table.emptyTable, destructive: true });
  if (!ok) return;
  commit((p) => emptyTable(p, tableId));
}

/** Adds or edits a guest. */
export function saveGuest(guest: Guest): void {
  commit((p) => upsertGuest(p, guest));
}

/** Deletes a guest after confirmation, freeing the seat. */
export async function deleteGuest(guestId: string): Promise<void> {
  const guest = getDerived(project()).guestsById.get(guestId);
  if (!guest) return;
  const ok = await confirmDialog({ message: t.guests.removeConfirm(guest.name), confirmLabel: t.app.remove, destructive: true });
  if (!ok) return;
  commit((p) => removeGuests(p, [guestId]));
}

/** Changes the venue size and returns the elements that no longer fit. */
export function resizeVenue(venue: Venue): ElementRef[] {
  commit((p) => ({ ...p, venue: { widthM: round2(venue.widthM), depthM: round2(venue.depthM) } }), 'venue');
  return elementsOutsideVenue(project());
}

/** Moves the given elements back inside the venue. */
export function bringInsideVenue(refs: ElementRef[]): void {
  commit((p) => {
    const ids = new Set(refs.map((r) => r.id));
    return {
      ...p,
      tables: p.tables.map((x) => (ids.has(x.id) ? { ...x, ...clampTableIntoVenue(x, p.venue) } : x)),
      fixtures: p.fixtures.map((x) => (ids.has(x.id) ? { ...x, ...clampFixtureIntoVenue(x, p.venue) } : x)),
      doors: p.doors.map((d) => ({ ...d, offsetM: round2(clampDoorOffset(d, d.offsetM, p.venue)) })),
    };
  });
}

/** Renumbers every non-highlighted table in reading order. */
export function renumberAllTables(): void {
  commit((p) => ({ ...p, tables: renumberTables(p.tables) }));
  toastSuccess(t.toasts.renumbered);
}
