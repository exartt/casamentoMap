import { describe, expect, it } from 'vitest';
import { FIXTURE_SPECS } from '@shared/config/defaults';
import { computeLayoutWarnings, elementsOutsideVenue } from '@shared/domain/layoutValidation';
import { createEmptyProject } from '@shared/domain/projectMigration';
import { createTable } from '@shared/domain/seating';
import type { Door, Fixture } from '@shared/domain/types';

function fixture(id: string, kind: Fixture['kind'], x: number, y: number, rotation = 0): Fixture {
  const spec = FIXTURE_SPECS[kind];
  return {
    id,
    kind,
    label: spec.labelPt,
    shape: spec.shape,
    x,
    y,
    rotation,
    widthM: spec.defaultWidthM,
    depthM: spec.defaultDepthM,
    color: spec.color,
    blocksPlacement: true,
    locked: false,
  };
}

describe('layout validation', () => {
  it('flags rotated tables that overlap', () => {
    const project = createEmptyProject('Teste');
    project.tables = [
      createTable('a', 'banquet', { x: 5, y: 5 }, 'Mesa 1', { rotation: 30 }),
      createTable('b', 'banquet', { x: 6, y: 5.5 }, 'Mesa 2', { rotation: 0 }),
    ];
    const warnings = computeLayoutWarnings(project);
    expect(warnings.some((w) => w.kind === 'overlap' && w.element.id === 'a' && w.other?.id === 'b')).toBe(true);
  });

  it('flags a table over a circular fixture', () => {
    const project = createEmptyProject('Teste');
    project.tables = [createTable('a', 'square', { x: 5, y: 5 }, 'Mesa 1')];
    project.fixtures = [fixture('tree', 'tree', 6.2, 5)];
    const warnings = computeLayoutWarnings(project);
    expect(warnings.some((w) => w.kind === 'overlap' && w.other?.id === 'tree')).toBe(true);
  });

  it('flags tables closer than the minimum aisle', () => {
    const project = createEmptyProject('Teste');
    const a = createTable('a', 'square', { x: 5, y: 5 }, 'Mesa 1');
    const footprint = 1.4 + 2 * 0.55;
    const b = createTable('b', 'square', { x: 5 + footprint + 0.5, y: 5 }, 'Mesa 2');
    project.tables = [a, b];
    const warnings = computeLayoutWarnings(project);
    expect(warnings.some((w) => w.kind === 'aisle')).toBe(true);
    expect(warnings.some((w) => w.kind === 'overlap')).toBe(false);
    const far = { ...b, x: 5 + footprint + 1.0 };
    project.tables = [a, far];
    expect(computeLayoutWarnings(project).some((w) => w.kind === 'aisle')).toBe(false);
  });

  it('flags a table in front of a door and marks emergency exits as critical', () => {
    const project = createEmptyProject('Teste');
    const door: Door = { id: 'd', kind: 'emergency', label: 'Saída', wall: 'top', offsetM: 5, widthM: 1.2 };
    project.doors = [door];
    project.tables = [createTable('a', 'square', { x: 5, y: 1.6 }, 'Mesa 1')];
    const warnings = computeLayoutWarnings(project);
    const blocked = warnings.find((w) => w.kind === 'doorBlocked');
    expect(blocked).toBeDefined();
    expect(blocked?.severity).toBe('critical');
  });

  it('flags elements outside the venue', () => {
    const project = createEmptyProject('Teste', { widthM: 10, depthM: 8 });
    project.tables = [createTable('a', 'banquet', { x: 9.5, y: 4 }, 'Mesa 1')];
    project.fixtures = [fixture('bar', 'bar', 5, 7.9)];
    const warnings = computeLayoutWarnings(project);
    expect(warnings.filter((w) => w.kind === 'outside')).toHaveLength(2);
    expect(elementsOutsideVenue(project)).toHaveLength(2);
  });
});
