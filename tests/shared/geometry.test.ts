import { describe, expect, it } from 'vitest';
import { SEAT_OFFSET_M } from '@shared/config/defaults';
import {
  circleIntersectsPolygon,
  clampDoorOffset,
  nearestWallPlacement,
  polygonsIntersect,
  rectCorners,
  seatSlots,
  seatWorldPositions,
  tableFootprint,
  boundingBox,
} from '@shared/domain/geometry';
import { createTable } from '@shared/domain/seating';

const close = (a: number, b: number) => Math.abs(a - b) < 1e-9;

describe('seat positions', () => {
  it('banquet has 5 seats on top and 5 on bottom', () => {
    const table = createTable('t1', 'banquet', { x: 5, y: 5 }, 'Mesa 1');
    const slots = seatSlots(table);
    expect(slots).toHaveLength(10);
    expect(slots.filter((s) => s.side === 'top')).toHaveLength(5);
    expect(slots.filter((s) => s.side === 'bottom')).toHaveLength(5);
    expect(slots.filter((s) => s.side === 'left' || s.side === 'right')).toHaveLength(0);
    const top = slots.filter((s) => s.side === 'top');
    expect(top.every((s) => close(s.localY, -(table.depthM / 2 + SEAT_OFFSET_M)))).toBe(true);
    const xs = top.map((s) => s.localX);
    for (let i = 1; i < xs.length; i += 1) expect(close(xs[i] - xs[i - 1], table.widthM / 5)).toBe(true);
  });

  it('square has 2 seats per side', () => {
    const table = createTable('t1', 'square', { x: 5, y: 5 }, 'Mesa 1');
    const slots = seatSlots(table);
    expect(slots).toHaveLength(8);
    for (const side of ['top', 'right', 'bottom', 'left'] as const) {
      expect(slots.filter((s) => s.side === side)).toHaveLength(2);
    }
  });

  it('rotation 0 keeps world seats around the center', () => {
    const table = createTable('t1', 'banquet', { x: 10, y: 7 }, 'Mesa 1');
    const world = seatWorldPositions(table);
    const top = world.filter((s) => s.side === 'top');
    expect(top.every((s) => close(s.y, 7 - (0.5 + SEAT_OFFSET_M)))).toBe(true);
  });

  it('rotation 90 moves banquet seats to the left and right of the center', () => {
    const table = createTable('t1', 'banquet', { x: 10, y: 7 }, 'Mesa 1', { rotation: 90 });
    const world = seatWorldPositions(table);
    const top = world.filter((s) => s.side === 'top');
    const bottom = world.filter((s) => s.side === 'bottom');
    expect(top.every((s) => close(s.x, 10 + (0.5 + SEAT_OFFSET_M)))).toBe(true);
    expect(bottom.every((s) => close(s.x, 10 - (0.5 + SEAT_OFFSET_M)))).toBe(true);
  });

  it('rotation 45 keeps seat distance from the center', () => {
    const base = createTable('t1', 'square', { x: 3, y: 3 }, 'Mesa 1');
    const rotated = { ...base, rotation: 45 };
    const a = seatWorldPositions(base);
    const b = seatWorldPositions(rotated);
    for (let i = 0; i < a.length; i += 1) {
      const da = Math.hypot(a[i].x - 3, a[i].y - 3);
      const db = Math.hypot(b[i].x - 3, b[i].y - 3);
      expect(close(da, db)).toBe(true);
    }
    expect(close(b[0].x, a[0].x)).toBe(false);
  });

  it('footprint covers the chairs', () => {
    const table = createTable('t1', 'banquet', { x: 5, y: 5 }, 'Mesa 1');
    const box = boundingBox(tableFootprint(table));
    expect(close(box.width, 2.8)).toBe(true);
    expect(close(box.height, 1 + 2 * (0.1 + 0.45))).toBe(true);
  });
});

describe('intersections', () => {
  it('detects rotated rectangles overlapping', () => {
    const a = rectCorners(0, 0, 2, 1, 45);
    const b = rectCorners(1, 0, 2, 1, 0);
    expect(polygonsIntersect(a, b)).toBe(true);
  });

  it('separates rectangles that only touch', () => {
    const a = rectCorners(0, 0, 2, 1, 0);
    const b = rectCorners(2, 0, 2, 1, 0);
    expect(polygonsIntersect(a, b)).toBe(false);
  });

  it('circle versus rectangle', () => {
    const rect = rectCorners(0, 0, 2, 2, 30);
    expect(circleIntersectsPolygon({ x: 1.5, y: 0, r: 0.6 }, rect)).toBe(true);
    expect(circleIntersectsPolygon({ x: 3, y: 0, r: 0.5 }, rect)).toBe(false);
  });
});

describe('doors', () => {
  it('finds the nearest wall', () => {
    const venue = { widthM: 20, depthM: 14 };
    expect(nearestWallPlacement({ x: 5, y: 0.2 }, venue).wall).toBe('top');
    expect(nearestWallPlacement({ x: 19.5, y: 7 }, venue).wall).toBe('right');
    expect(nearestWallPlacement({ x: 10, y: 13.8 }, venue).wall).toBe('bottom');
    expect(nearestWallPlacement({ x: 0.3, y: 7 }, venue).wall).toBe('left');
  });

  it('clamps the offset inside the wall', () => {
    const venue = { widthM: 20, depthM: 14 };
    expect(clampDoorOffset({ wall: 'top', widthM: 1.2 }, -5, venue)).toBe(0.6);
    expect(clampDoorOffset({ wall: 'top', widthM: 1.2 }, 50, venue)).toBe(19.4);
  });
});
