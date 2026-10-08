import { DEFAULT_SETTINGS, DEFAULT_VENUE, SCHEMA_VERSION } from '../config/defaults';
import type { ProjectData, Venue } from './types';

/** Creates an empty project document with default settings. */
export function createEmptyProject(name: string, venue: Venue = DEFAULT_VENUE): ProjectData {
  return {
    schemaVersion: SCHEMA_VERSION,
    name,
    venue: { ...venue },
    tables: [],
    fixtures: [],
    doors: [],
    guests: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

type Migration = (doc: Record<string, unknown>) => Record<string, unknown>;

const migrations: Record<number, Migration> = {};

/** Upgrades a raw document to the current schema version, filling defaults for missing sections. */
export function migrateProjectData(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return raw;
  let doc: Record<string, unknown> = { ...(raw as Record<string, unknown>) };
  let version = typeof doc.schemaVersion === 'number' ? doc.schemaVersion : 1;
  while (version < SCHEMA_VERSION) {
    const step = migrations[version];
    if (!step) break;
    doc = step(doc);
    version += 1;
    doc.schemaVersion = version;
  }
  if (typeof doc.schemaVersion !== 'number') doc.schemaVersion = SCHEMA_VERSION;
  if (typeof doc.settings !== 'object' || doc.settings === null) doc.settings = { ...DEFAULT_SETTINGS };
  else doc.settings = { ...DEFAULT_SETTINGS, ...(doc.settings as Record<string, unknown>) };
  if (!Array.isArray(doc.tables)) doc.tables = [];
  if (!Array.isArray(doc.fixtures)) doc.fixtures = [];
  if (!Array.isArray(doc.doors)) doc.doors = [];
  if (!Array.isArray(doc.guests)) doc.guests = [];
  if (typeof doc.venue !== 'object' || doc.venue === null) doc.venue = { ...DEFAULT_VENUE };
  return doc;
}
