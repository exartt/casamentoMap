import {
  SEAT_OFFSET_M,
  SEAT_SIDE_ORDER,
  SEAT_SIZE_M,
  TABLE_SPECS,
  WALL_THICKNESS_M,
} from '../config/defaults';
import type { Door, Fixture, Seat, SeatSide, Table, TableKind, Venue, Wall } from './types';

export type Point = { x: number; y: number };

export type Polygon = Point[];

export type Circle = { x: number; y: number; r: number };

export type Rect = { x: number; y: number; width: number; height: number };

export type Shape = { kind: 'polygon'; points: Polygon } | { kind: 'circle'; circle: Circle };

export type SeatSlot = {
  index: number;
  side: SeatSide;
  localX: number;
  localY: number;
  enabled: boolean;
  guestId: string | null;
};

/** Converts degrees to radians. */
export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Rotates a point around a center by the given angle in degrees (clockwise in screen coordinates). */
export function rotatePoint(point: Point, center: Point, deg: number): Point {
  const rad = degToRad(deg);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return { x: center.x + dx * cos - dy * sin, y: center.y + dx * sin + dy * cos };
}

/** Converts a world point into the local (unrotated, centered) frame of an element. */
export function toLocal(point: Point, center: Point, rotationDeg: number): Point {
  const p = rotatePoint(point, center, -rotationDeg);
  return { x: p.x - center.x, y: p.y - center.y };
}

/** Converts a local point of an element into world coordinates. */
export function toWorld(local: Point, center: Point, rotationDeg: number): Point {
  return rotatePoint({ x: center.x + local.x, y: center.y + local.y }, center, rotationDeg);
}

/** Returns the four corners of a rotated rectangle given its center, size and rotation. */
export function rectCorners(cx: number, cy: number, width: number, height: number, rotationDeg: number): Polygon {
  const hw = width / 2;
  const hh = height / 2;
  const center = { x: cx, y: cy };
  return [
    rotatePoint({ x: cx - hw, y: cy - hh }, center, rotationDeg),
    rotatePoint({ x: cx + hw, y: cy - hh }, center, rotationDeg),
    rotatePoint({ x: cx + hw, y: cy + hh }, center, rotationDeg),
    rotatePoint({ x: cx - hw, y: cy + hh }, center, rotationDeg),
  ];
}

/** Returns the axis-aligned bounding box of a polygon. */
export function boundingBox(points: Polygon): Rect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Returns the bounding box of any shape. */
export function shapeBounds(shape: Shape): Rect {
  if (shape.kind === 'polygon') return boundingBox(shape.points);
  const { x, y, r } = shape.circle;
  return { x: x - r, y: y - r, width: r * 2, height: r * 2 };
}

function projectPolygon(points: Polygon, axis: Point): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const p of points) {
    const dot = p.x * axis.x + p.y * axis.y;
    if (dot < min) min = dot;
    if (dot > max) max = dot;
  }
  return { min, max };
}

function edgeNormals(points: Polygon): Point[] {
  const normals: Point[] = [];
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const len = Math.hypot(ex, ey);
    if (len === 0) continue;
    normals.push({ x: -ey / len, y: ex / len });
  }
  return normals;
}

/** Separating axis test for two convex polygons. Touching edges do not count as intersection. */
export function polygonsIntersect(a: Polygon, b: Polygon, epsilon = 1e-6): boolean {
  const axes = [...edgeNormals(a), ...edgeNormals(b)];
  for (const axis of axes) {
    const pa = projectPolygon(a, axis);
    const pb = projectPolygon(b, axis);
    if (pa.max <= pb.min + epsilon || pb.max <= pa.min + epsilon) return false;
  }
  return true;
}

/** Returns true when the point lies inside the convex polygon. */
export function pointInPolygon(point: Point, polygon: Polygon): boolean {
  let sign = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
    if (cross === 0) continue;
    const current = cross > 0 ? 1 : -1;
    if (sign === 0) sign = current;
    else if (sign !== current) return false;
  }
  return true;
}

/** Distance from a point to a line segment. */
export function distancePointToSegment(p: Point, a: Point, b: Point): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lenSq = abx * abx + aby * aby;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * abx), p.y - (a.y + t * aby));
}

/** Circle versus convex polygon intersection test. */
export function circleIntersectsPolygon(circle: Circle, polygon: Polygon, epsilon = 1e-6): boolean {
  const center = { x: circle.x, y: circle.y };
  if (pointInPolygon(center, polygon)) return true;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    if (distancePointToSegment(center, a, b) < circle.r - epsilon) return true;
  }
  return false;
}

/** Circle versus circle intersection test. */
export function circlesIntersect(a: Circle, b: Circle, epsilon = 1e-6): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r - epsilon;
}

/** Generic intersection test for the shapes used by layout validation. */
export function shapesIntersect(a: Shape, b: Shape): boolean {
  if (a.kind === 'polygon' && b.kind === 'polygon') return polygonsIntersect(a.points, b.points);
  if (a.kind === 'circle' && b.kind === 'circle') return circlesIntersect(a.circle, b.circle);
  if (a.kind === 'circle' && b.kind === 'polygon') return circleIntersectsPolygon(a.circle, b.points);
  if (a.kind === 'polygon' && b.kind === 'circle') return circleIntersectsPolygon(b.circle, a.points);
  return false;
}

/** Grows a shape outward by the given margin (polygon corners are pushed away from the centroid along each axis). */
export function expandShape(shape: Shape, margin: number): Shape {
  if (shape.kind === 'circle') {
    return { kind: 'circle', circle: { ...shape.circle, r: shape.circle.r + margin } };
  }
  const pts = shape.points;
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const expanded: Polygon = [];
  for (let i = 0; i < pts.length; i += 1) {
    const prev = pts[(i + pts.length - 1) % pts.length];
    const curr = pts[i];
    const next = pts[(i + 1) % pts.length];
    const d1 = normalize({ x: curr.x - prev.x, y: curr.y - prev.y });
    const d2 = normalize({ x: next.x - curr.x, y: next.y - curr.y });
    const n1 = outwardNormal(d1, curr, { x: cx, y: cy });
    const n2 = outwardNormal(d2, curr, { x: cx, y: cy });
    expanded.push({ x: curr.x + (n1.x + n2.x) * margin, y: curr.y + (n1.y + n2.y) * margin });
  }
  return { kind: 'polygon', points: expanded };
}

function normalize(v: Point): Point {
  const len = Math.hypot(v.x, v.y);
  return len === 0 ? { x: 0, y: 0 } : { x: v.x / len, y: v.y / len };
}

function outwardNormal(dir: Point, at: Point, centroid: Point): Point {
  const n = { x: -dir.y, y: dir.x };
  const toCenter = { x: centroid.x - at.x, y: centroid.y - at.y };
  return n.x * toCenter.x + n.y * toCenter.y > 0 ? { x: -n.x, y: -n.y } : n;
}

/** Returns the seat slots of a table in its local frame, with sides according to the table kind. */
export function seatSlots(table: Pick<Table, 'kind' | 'widthM' | 'depthM' | 'seats'>): SeatSlot[] {
  return seatLayoutByKind[table.kind](table);
}

type SeatLayoutFn = (table: Pick<Table, 'widthM' | 'depthM' | 'seats'>) => SeatSlot[];

/** Seat layout per table kind; a round-table layout can be added here without touching callers. */
export const seatLayoutByKind: Record<TableKind, SeatLayoutFn> = {
  banquet: (table) => rectangularLayout(table, 'banquet'),
  square: (table) => rectangularLayout(table, 'square'),
};

function rectangularLayout(table: Pick<Table, 'widthM' | 'depthM' | 'seats'>, kind: TableKind): SeatSlot[] {
  const spec = TABLE_SPECS[kind];
  const slots: SeatSlot[] = [];
  let index = 0;
  for (const side of SEAT_SIDE_ORDER) {
    const count = spec.seatsPerSide[side];
    for (let i = 0; i < count; i += 1) {
      const seat: Seat | undefined = table.seats[index];
      const t = (i + 0.5) / count;
      let localX = 0;
      let localY = 0;
      if (side === 'top') {
        localX = -table.widthM / 2 + table.widthM * t;
        localY = -(table.depthM / 2 + SEAT_OFFSET_M);
      } else if (side === 'bottom') {
        localX = table.widthM / 2 - table.widthM * t;
        localY = table.depthM / 2 + SEAT_OFFSET_M;
      } else if (side === 'right') {
        localX = table.widthM / 2 + SEAT_OFFSET_M;
        localY = -table.depthM / 2 + table.depthM * t;
      } else {
        localX = -(table.widthM / 2 + SEAT_OFFSET_M);
        localY = table.depthM / 2 - table.depthM * t;
      }
      slots.push({
        index,
        side,
        localX,
        localY,
        enabled: seat ? seat.enabled : true,
        guestId: seat ? seat.guestId : null,
      });
      index += 1;
    }
  }
  return slots;
}

/** Returns the world position of each seat center. */
export function seatWorldPositions(table: Table): Array<SeatSlot & Point> {
  const center = { x: table.x, y: table.y };
  return seatSlots(table).map((slot) => {
    const world = toWorld({ x: slot.localX, y: slot.localY }, center, table.rotation);
    return { ...slot, x: world.x, y: world.y };
  });
}

/** Local bounding size of the table plus its enabled seats, before rotation. */
export function tableFootprintSize(table: Table): { width: number; height: number } {
  const slots = seatSlots(table).filter((s) => s.enabled);
  const hasSide = (side: SeatSide) => slots.some((s) => s.side === side);
  const extra = SEAT_OFFSET_M + SEAT_SIZE_M / 2;
  const left = hasSide('left') ? extra : 0;
  const right = hasSide('right') ? extra : 0;
  const top = hasSide('top') ? extra : 0;
  const bottom = hasSide('bottom') ? extra : 0;
  return { width: table.widthM + left + right, height: table.depthM + top + bottom };
}

/** Rotated rectangle covering the table and all its enabled seats. */
export function tableFootprint(table: Table): Polygon {
  const slots = seatSlots(table).filter((s) => s.enabled);
  const half = SEAT_SIZE_M / 2;
  let minX = -table.widthM / 2;
  let maxX = table.widthM / 2;
  let minY = -table.depthM / 2;
  let maxY = table.depthM / 2;
  for (const s of slots) {
    minX = Math.min(minX, s.localX - half);
    maxX = Math.max(maxX, s.localX + half);
    minY = Math.min(minY, s.localY - half);
    maxY = Math.max(maxY, s.localY + half);
  }
  const center = { x: table.x, y: table.y };
  const local: Polygon = [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];
  return local.map((p) => toWorld(p, center, table.rotation));
}

/** Shape used in validations for a table (its footprint polygon). */
export function tableShape(table: Table): Shape {
  return { kind: 'polygon', points: tableFootprint(table) };
}

/** Shape used in validations for a fixture. */
export function fixtureShape(fixture: Fixture): Shape {
  if (fixture.shape === 'circle') {
    return { kind: 'circle', circle: { x: fixture.x, y: fixture.y, r: fixture.widthM / 2 } };
  }
  return {
    kind: 'polygon',
    points: rectCorners(fixture.x, fixture.y, fixture.widthM, fixture.depthM, fixture.rotation),
  };
}

/** Length of a wall of the venue. */
export function wallLength(wall: Wall, venue: Venue): number {
  return wall === 'top' || wall === 'bottom' ? venue.widthM : venue.depthM;
}

/** Rotation applied to a door group so that its local +y axis points into the venue. */
export function wallRotation(wall: Wall): number {
  switch (wall) {
    case 'top':
      return 0;
    case 'right':
      return 90;
    case 'bottom':
      return 180;
    case 'left':
      return 270;
  }
}

/** World position of the door center on its wall. */
export function doorCenter(door: Pick<Door, 'wall' | 'offsetM'>, venue: Venue): Point {
  switch (door.wall) {
    case 'top':
      return { x: door.offsetM, y: 0 };
    case 'bottom':
      return { x: door.offsetM, y: venue.depthM };
    case 'left':
      return { x: 0, y: door.offsetM };
    case 'right':
      return { x: venue.widthM, y: door.offsetM };
  }
}

/** Clamps a door offset so the door stays within its wall. */
export function clampDoorOffset(door: Pick<Door, 'wall' | 'widthM'>, offsetM: number, venue: Venue): number {
  const length = wallLength(door.wall, venue);
  const half = Math.min(door.widthM / 2, length / 2);
  return Math.max(half, Math.min(length - half, offsetM));
}

/** Finds the nearest wall for a point and the offset along that wall. */
export function nearestWallPlacement(point: Point, venue: Venue): { wall: Wall; offsetM: number } {
  const candidates: Array<{ wall: Wall; distance: number; offsetM: number }> = [
    { wall: 'top', distance: Math.abs(point.y), offsetM: point.x },
    { wall: 'bottom', distance: Math.abs(point.y - venue.depthM), offsetM: point.x },
    { wall: 'left', distance: Math.abs(point.x), offsetM: point.y },
    { wall: 'right', distance: Math.abs(point.x - venue.widthM), offsetM: point.y },
  ];
  candidates.sort((a, b) => a.distance - b.distance);
  return { wall: candidates[0].wall, offsetM: candidates[0].offsetM };
}

/** Polygon of the clearance area in front of a door, inside the venue. */
export function doorClearancePolygon(door: Door, venue: Venue, clearanceM: number): Polygon {
  const center = doorCenter(door, venue);
  const rotation = wallRotation(door.wall);
  const local: Polygon = [
    { x: -door.widthM / 2, y: 0 },
    { x: door.widthM / 2, y: 0 },
    { x: door.widthM / 2, y: clearanceM },
    { x: -door.widthM / 2, y: clearanceM },
  ];
  return local.map((p) => toWorld(p, center, rotation));
}

/** Polygon of the door leaf drawn over the wall. */
export function doorLeafPolygon(door: Door, venue: Venue): Polygon {
  const center = doorCenter(door, venue);
  const rotation = wallRotation(door.wall);
  const t = WALL_THICKNESS_M;
  const local: Polygon = [
    { x: -door.widthM / 2, y: -t },
    { x: door.widthM / 2, y: -t },
    { x: door.widthM / 2, y: t },
    { x: -door.widthM / 2, y: t },
  ];
  return local.map((p) => toWorld(p, center, rotation));
}

/** Returns true when the whole shape lies inside the venue rectangle. */
export function shapeInsideVenue(shape: Shape, venue: Venue, epsilon = 1e-6): boolean {
  const b = shapeBounds(shape);
  return (
    b.x >= -epsilon &&
    b.y >= -epsilon &&
    b.x + b.width <= venue.widthM + epsilon &&
    b.y + b.height <= venue.depthM + epsilon
  );
}

/** Distances from the bounds of a shape to the nearest wall in each axis. */
export function distancesToWalls(shape: Shape, venue: Venue): { left: number; right: number; top: number; bottom: number } {
  const b = shapeBounds(shape);
  return {
    left: b.x,
    right: venue.widthM - (b.x + b.width),
    top: b.y,
    bottom: venue.depthM - (b.y + b.height),
  };
}

/** Snaps a value to the nearest multiple of step. */
export function snapValue(value: number, step: number): number {
  if (step <= 0) return value;
  return Math.round(value / step) * step;
}

/** Snaps an angle to the nearest multiple of step degrees, normalized to [0, 360). */
export function snapAngle(deg: number, step: number): number {
  const snapped = step > 0 ? Math.round(deg / step) * step : deg;
  return normalizeAngle(snapped);
}

/** Normalizes an angle to the range [0, 360). */
export function normalizeAngle(deg: number): number {
  const r = deg % 360;
  return r < 0 ? r + 360 : r;
}

/** Returns true when the point lies within the rotated rectangle. */
export function pointInRotatedRect(point: Point, cx: number, cy: number, width: number, height: number, rotationDeg: number): boolean {
  const local = toLocal(point, { x: cx, y: cy }, rotationDeg);
  return Math.abs(local.x) <= width / 2 && Math.abs(local.y) <= height / 2;
}

/** Returns the seat index under a world point, or null. */
export function seatAtPoint(table: Table, point: Point): number | null {
  const local = toLocal(point, { x: table.x, y: table.y }, table.rotation);
  for (const slot of seatSlots(table)) {
    if (Math.abs(local.x - slot.localX) <= SEAT_SIZE_M / 2 && Math.abs(local.y - slot.localY) <= SEAT_SIZE_M / 2) {
      return slot.index;
    }
  }
  return null;
}

/** Returns true when the point is over the table top or any of its seats. */
export function pointOverTable(table: Table, point: Point): boolean {
  if (pointInRotatedRect(point, table.x, table.y, table.widthM, table.depthM, table.rotation)) return true;
  return seatAtPoint(table, point) !== null;
}

/** Returns true when the point is over the fixture. */
export function pointOverFixture(fixture: Fixture, point: Point): boolean {
  if (fixture.shape === 'circle') {
    return Math.hypot(point.x - fixture.x, point.y - fixture.y) <= fixture.widthM / 2;
  }
  return pointInRotatedRect(point, fixture.x, fixture.y, fixture.widthM, fixture.depthM, fixture.rotation);
}

/** Clamps a table position so its footprint fits inside the venue when possible. */
export function clampTableIntoVenue(table: Table, venue: Venue): { x: number; y: number } {
  const bounds = boundingBox(tableFootprint(table));
  return clampBoundsIntoVenue(table.x, table.y, bounds, venue);
}

/** Clamps a fixture position so its shape fits inside the venue when possible. */
export function clampFixtureIntoVenue(fixture: Fixture, venue: Venue): { x: number; y: number } {
  const bounds = shapeBounds(fixtureShape(fixture));
  return clampBoundsIntoVenue(fixture.x, fixture.y, bounds, venue);
}

function clampBoundsIntoVenue(cx: number, cy: number, bounds: Rect, venue: Venue): { x: number; y: number } {
  const leftExtent = cx - bounds.x;
  const rightExtent = bounds.x + bounds.width - cx;
  const topExtent = cy - bounds.y;
  const bottomExtent = bounds.y + bounds.height - cy;
  const minX = leftExtent;
  const maxX = venue.widthM - rightExtent;
  const minY = topExtent;
  const maxY = venue.depthM - bottomExtent;
  const x = maxX < minX ? venue.widthM / 2 : Math.max(minX, Math.min(maxX, cx));
  const y = maxY < minY ? venue.depthM / 2 : Math.max(minY, Math.min(maxY, cy));
  return { x, y };
}
