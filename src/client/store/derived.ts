import { GROUP_COLORS, NO_GROUP_COLOR } from '@shared/config/defaults';
import { computeLayoutWarnings, warningLevelsByElement, type ElementWarningLevel, type LayoutWarning } from '@shared/domain/layoutValidation';
import { guestSeatMap, projectCounters, type SeatLocation } from '@shared/domain/seating';
import { compareNames, matchesSearch } from '@shared/domain/text';
import type { Door, Fixture, Guest, ProjectData, Table } from '@shared/domain/types';

export type Derived = {
  guestsById: Map<string, Guest>;
  tablesById: Map<string, Table>;
  fixturesById: Map<string, Fixture>;
  doorsById: Map<string, Door>;
  seatMap: Map<string, SeatLocation>;
  warnings: LayoutWarning[];
  warningLevels: Map<string, ElementWarningLevel>;
  counters: ReturnType<typeof projectCounters>;
  groups: string[];
  groupColors: Map<string, string>;
  sortedGuests: Guest[];
};

const cache = new WeakMap<ProjectData, Derived>();

/** Returns memoized derived data for a project document (computed once per document reference). */
export function getDerived(project: ProjectData): Derived {
  const cached = cache.get(project);
  if (cached) return cached;
  const guestsById = new Map(project.guests.map((g) => [g.id, g] as const));
  const tablesById = new Map(project.tables.map((t) => [t.id, t] as const));
  const fixturesById = new Map(project.fixtures.map((f) => [f.id, f] as const));
  const doorsById = new Map(project.doors.map((d) => [d.id, d] as const));
  const seatMap = guestSeatMap(project);
  const warnings = computeLayoutWarnings(project);
  const warningLevels = warningLevelsByElement(warnings);
  const counters = projectCounters(project);
  const groupSet = new Set<string>();
  for (const g of project.guests) if (g.group && g.group.trim() !== '') groupSet.add(g.group.trim());
  const groups = [...groupSet].sort(compareNames);
  const groupColors = new Map<string, string>();
  groups.forEach((group, i) => groupColors.set(group, GROUP_COLORS[i % GROUP_COLORS.length]));
  const sortedGuests = [...project.guests].sort((a, b) => compareNames(a.name, b.name));
  const derived: Derived = {
    guestsById,
    tablesById,
    fixturesById,
    doorsById,
    seatMap,
    warnings,
    warningLevels,
    counters,
    groups,
    groupColors,
    sortedGuests,
  };
  cache.set(project, derived);
  return derived;
}

/** Color for a guest group, falling back to the neutral color. */
export function colorForGroup(derived: Derived, group: string | undefined): string {
  if (!group) return NO_GROUP_COLOR;
  return derived.groupColors.get(group.trim()) ?? NO_GROUP_COLOR;
}

export type SearchResult = { tableIds: Set<string>; seatsByTable: Map<string, number[]>; guestCount: number };

/** Finds the tables and seats whose guests match a search query (accent and case insensitive). */
export function searchSeatedGuests(project: ProjectData, query: string): SearchResult | null {
  const needle = query.trim();
  if (needle === '') return null;
  const derived = getDerived(project);
  const tableIds = new Set<string>();
  const seatsByTable = new Map<string, number[]>();
  let guestCount = 0;
  for (const table of project.tables) {
    for (const seat of table.seats) {
      if (!seat.guestId) continue;
      const guest = derived.guestsById.get(seat.guestId);
      if (!guest || !matchesSearch(guest.name, needle)) continue;
      guestCount += 1;
      tableIds.add(table.id);
      const list = seatsByTable.get(table.id) ?? [];
      list.push(seat.index);
      seatsByTable.set(table.id, list);
    }
  }
  return { tableIds, seatsByTable, guestCount };
}
