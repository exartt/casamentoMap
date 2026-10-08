import {
  doorClearancePolygon,
  expandShape,
  fixtureShape,
  shapeInsideVenue,
  shapesIntersect,
  tableShape,
  type Shape,
} from './geometry';
import type { Door, ElementRef, Fixture, ProjectData, Table } from './types';

export type WarningKind = 'overlap' | 'aisle' | 'outside' | 'doorBlocked';

export type WarningSeverity = 'warning' | 'error' | 'critical';

export type LayoutWarning = {
  id: string;
  kind: WarningKind;
  severity: WarningSeverity;
  element: ElementRef;
  other: ElementRef | null;
  message: string;
};

type Occupant = { ref: ElementRef; label: string; shape: Shape; blocks: boolean };

function tableOccupant(table: Table): Occupant {
  return { ref: { type: 'table', id: table.id }, label: table.label, shape: tableShape(table), blocks: true };
}

function fixtureOccupant(fixture: Fixture): Occupant {
  return {
    ref: { type: 'fixture', id: fixture.id },
    label: fixture.label,
    shape: fixtureShape(fixture),
    blocks: fixture.blocksPlacement,
  };
}

function doorLabel(door: Door): string {
  return door.label;
}

/** Computes every layout warning of the project: overlaps, aisles, elements outside the venue and blocked doors. */
export function computeLayoutWarnings(project: ProjectData): LayoutWarning[] {
  const warnings: LayoutWarning[] = [];
  const tables = project.tables.map(tableOccupant);
  const fixtures = project.fixtures.map(fixtureOccupant);
  const blocking = [...tables, ...fixtures.filter((f) => f.blocks)];
  const halfAisle = project.settings.minAisleM / 2;
  const expanded = new Map<string, Shape>();
  for (const occ of blocking) expanded.set(occ.ref.id, expandShape(occ.shape, halfAisle));

  for (let i = 0; i < tables.length; i += 1) {
    const a = tables[i];
    for (let j = 0; j < blocking.length; j += 1) {
      const b = blocking[j];
      if (b.ref.type === 'table' && j <= i) continue;
      if (shapesIntersect(a.shape, b.shape)) {
        warnings.push({
          id: `overlap:${a.ref.id}:${b.ref.id}`,
          kind: 'overlap',
          severity: 'error',
          element: a.ref,
          other: b.ref,
          message: `${a.label} sobrepõe ${b.label}`,
        });
        continue;
      }
      const ea = expanded.get(a.ref.id) as Shape;
      const eb = expanded.get(b.ref.id) as Shape;
      if (shapesIntersect(ea, eb)) {
        warnings.push({
          id: `aisle:${a.ref.id}:${b.ref.id}`,
          kind: 'aisle',
          severity: 'warning',
          element: a.ref,
          other: b.ref,
          message: `Circulação menor que ${formatM(project.settings.minAisleM)} entre ${a.label} e ${b.label}`,
        });
      }
    }
  }

  for (const occ of [...tables, ...fixtures]) {
    if (!shapeInsideVenue(occ.shape, project.venue)) {
      warnings.push({
        id: `outside:${occ.ref.id}`,
        kind: 'outside',
        severity: 'error',
        element: occ.ref,
        other: null,
        message: `${occ.label} está fora do salão`,
      });
    }
  }

  for (const door of project.doors) {
    const clearance: Shape = {
      kind: 'polygon',
      points: doorClearancePolygon(door, project.venue, project.settings.doorClearanceM),
    };
    for (const occ of [...tables, ...fixtures]) {
      if (shapesIntersect(occ.shape, clearance)) {
        const emergency = door.kind === 'emergency';
        warnings.push({
          id: `door:${door.id}:${occ.ref.id}`,
          kind: 'doorBlocked',
          severity: emergency ? 'critical' : 'error',
          element: occ.ref,
          other: { type: 'door', id: door.id },
          message: emergency
            ? `${occ.label} bloqueia a saída de emergência "${doorLabel(door)}"`
            : `${occ.label} bloqueia a passagem da porta "${doorLabel(door)}"`,
        });
      }
    }
  }

  return warnings;
}

function formatM(value: number): string {
  return `${value.toFixed(2).replace('.', ',')} m`;
}

export type ElementWarningLevel = 'none' | 'warning' | 'error' | 'critical';

/** Maps each element id to its most severe warning level. */
export function warningLevelsByElement(warnings: LayoutWarning[]): Map<string, ElementWarningLevel> {
  const rank: Record<ElementWarningLevel, number> = { none: 0, warning: 1, error: 2, critical: 3 };
  const map = new Map<string, ElementWarningLevel>();
  const bump = (id: string, level: ElementWarningLevel) => {
    const current = map.get(id) ?? 'none';
    if (rank[level] > rank[current]) map.set(id, level);
  };
  for (const w of warnings) {
    bump(w.element.id, w.severity);
    if (w.other && w.other.type !== 'door') bump(w.other.id, w.severity);
  }
  return map;
}

/** Returns true when the given table or fixture overlaps another blocking element (used by "prevent overlap"). */
export function elementOverlaps(project: ProjectData, ref: ElementRef): boolean {
  if (ref.type === 'door') return false;
  const self =
    ref.type === 'table'
      ? project.tables.find((t) => t.id === ref.id)
      : project.fixtures.find((f) => f.id === ref.id);
  if (!self) return false;
  const shape = ref.type === 'table' ? tableShape(self as Table) : fixtureShape(self as Fixture);
  for (const t of project.tables) {
    if (t.id === ref.id) continue;
    if (shapesIntersect(shape, tableShape(t))) return true;
  }
  for (const f of project.fixtures) {
    if (f.id === ref.id || !f.blocksPlacement) continue;
    if (shapesIntersect(shape, fixtureShape(f))) return true;
  }
  return false;
}

/** Lists the tables and fixtures that do not fit entirely inside the venue. */
export function elementsOutsideVenue(project: ProjectData): ElementRef[] {
  const out: ElementRef[] = [];
  for (const t of project.tables) {
    if (!shapeInsideVenue(tableShape(t), project.venue)) out.push({ type: 'table', id: t.id });
  }
  for (const f of project.fixtures) {
    if (!shapeInsideVenue(fixtureShape(f), project.venue)) out.push({ type: 'fixture', id: f.id });
  }
  return out;
}
