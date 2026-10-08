import { PX_PER_M, ZOOM_MAX, ZOOM_MIN } from '@shared/config/defaults';
import { pointOverFixture, pointOverTable, seatAtPoint, snapValue, type Point } from '@shared/domain/geometry';
import { tableOccupancy } from '@shared/domain/seating';
import type { ProjectData, Table, Venue } from '@shared/domain/types';
import type { Viewport } from '../../store/uiStore';

export const FIT_PADDING_PX = 40;

export const FIT_PADDING_MIN_PX = 10;

export const FIT_PADDING_RATIO = 0.04;

export const FOCUS_SPAN_M = 9;

export const COLORS = {
  floor: '#fbfaf7',
  wall: '#3b3b3b',
  grid: '#e3e0d8',
  gridMinor: '#efede7',
  tableEmpty: '#f4f1ea',
  tablePartial: '#dbe7f5',
  tableFull: '#d5ecd9',
  tableStroke: '#8a8378',
  tableHighlight: '#f6e3b4',
  tableHighlightStroke: '#b7791f',
  seatFree: '#ffffff',
  seatStroke: '#8a8378',
  seatDisabled: '#c9c4ba',
  selection: '#2b6cb0',
  warning: '#d69e2e',
  error: '#e53e3e',
  critical: '#9b2c2c',
  text: '#2d3748',
  textMuted: '#718096',
  dropTarget: '#2b6cb0',
  dropRefused: '#e53e3e',
  guide: '#2b6cb0',
  searchMatch: '#d53f8c',
} as const;

/** Converts a screen (container pixel) point into meters using the current viewport. */
export function screenToWorld(point: Point, viewport: Viewport): Point {
  const scale = viewport.zoom * PX_PER_M;
  return { x: (point.x - viewport.x) / scale, y: (point.y - viewport.y) / scale };
}

/** Converts a point in meters into container pixels. */
export function worldToScreen(point: Point, viewport: Viewport): Point {
  const scale = viewport.zoom * PX_PER_M;
  return { x: point.x * scale + viewport.x, y: point.y * scale + viewport.y };
}

/** Clamps the zoom within the allowed range. */
export function clampZoom(zoom: number): number {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom));
}

/** Computes a viewport that shows the whole venue centered in the stage. */
export function fitViewport(venue: Venue, stage: { width: number; height: number }): Viewport {
  const pad = Math.max(FIT_PADDING_MIN_PX, Math.min(FIT_PADDING_PX, Math.min(stage.width, stage.height) * FIT_PADDING_RATIO));
  const available = { width: Math.max(stage.width - pad * 2, 50), height: Math.max(stage.height - pad * 2, 50) };
  const zoom = clampZoom(Math.min(available.width / (venue.widthM * PX_PER_M), available.height / (venue.depthM * PX_PER_M)));
  const scale = zoom * PX_PER_M;
  return {
    zoom,
    x: (stage.width - venue.widthM * scale) / 2,
    y: (stage.height - venue.depthM * scale) / 2,
  };
}

/** Computes a viewport that keeps the zoom and places the given world point at an anchor of the stage (fractions, center by default). */
export function centerViewportOn(
  point: Point,
  viewport: Viewport,
  stage: { width: number; height: number },
  anchor: { x: number; y: number } = { x: 0.5, y: 0.5 },
): Viewport {
  const scale = viewport.zoom * PX_PER_M;
  return { zoom: viewport.zoom, x: stage.width * anchor.x - point.x * scale, y: stage.height * anchor.y - point.y * scale };
}

/** Zoom that shows roughly FOCUS_SPAN_M meters across the smaller stage side, never below the given minimum. */
export function focusZoom(stage: { width: number; height: number }, minZoom: number): number {
  return clampZoom(Math.max(minZoom, Math.min(stage.width, stage.height) / (FOCUS_SPAN_M * PX_PER_M)));
}

/** Distance between two touch points. */
export function touchDistance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Zooms around a screen point so the world point under the cursor stays fixed. */
export function zoomAround(viewport: Viewport, screenPoint: Point, nextZoom: number): Viewport {
  const zoom = clampZoom(nextZoom);
  const world = screenToWorld(screenPoint, viewport);
  const scale = zoom * PX_PER_M;
  return { zoom, x: screenPoint.x - world.x * scale, y: screenPoint.y - world.y * scale };
}

/** World point at the center of the visible stage area. */
export function visibleCenter(viewport: Viewport, stage: { width: number; height: number }): Point {
  return screenToWorld({ x: stage.width / 2, y: stage.height / 2 }, viewport);
}

/** Snaps a position to the grid when snapping is enabled. */
export function snapPosition(point: Point, settings: ProjectData['settings']): Point {
  if (!settings.snapEnabled) return { x: round2(point.x), y: round2(point.y) };
  return { x: round2(snapValue(point.x, settings.snapStepM)), y: round2(snapValue(point.y, settings.snapStepM)) };
}

/** Rounds to two decimals. */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Fill color of a table top according to its occupancy. */
export function tableFillColor(table: Table): string {
  if (table.highlight) return COLORS.tableHighlight;
  const occ = tableOccupancy(table);
  if (occ.occupied === 0) return COLORS.tableEmpty;
  if (occ.occupied >= occ.enabled) return COLORS.tableFull;
  return COLORS.tablePartial;
}

export type DropHit = { tableId: string; seatIndex: number | null } | null;

/** Finds the table and seat under a world point, for guest drops. */
export function hitTestDrop(project: ProjectData, point: Point): DropHit {
  for (let i = project.tables.length - 1; i >= 0; i -= 1) {
    const table = project.tables[i];
    const seatIndex = seatAtPoint(table, point);
    if (seatIndex !== null) return { tableId: table.id, seatIndex };
    if (pointOverTable(table, point)) return { tableId: table.id, seatIndex: null };
  }
  return null;
}

/** Finds the element under a world point, tables first, then fixtures. */
export function hitTestElement(project: ProjectData, point: Point): { type: 'table' | 'fixture'; id: string } | null {
  for (let i = project.tables.length - 1; i >= 0; i -= 1) {
    if (pointOverTable(project.tables[i], point)) return { type: 'table', id: project.tables[i].id };
  }
  for (let i = project.fixtures.length - 1; i >= 0; i -= 1) {
    if (pointOverFixture(project.fixtures[i], point)) return { type: 'fixture', id: project.fixtures[i].id };
  }
  return null;
}

/** Converts a hex color to an rgba string with the given alpha. */
export function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Picks black or white text depending on the background luminance. */
export function contrastText(hex: string): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#1a202c' : '#ffffff';
}
