import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { PROJECT_ID, VERSION_HISTORY_LIMIT } from '@shared/config/defaults';
import { summarizeChanges } from '@shared/domain/changeSummary';
import { migrateProjectData } from '@shared/domain/projectMigration';
import { validateProject } from '@shared/domain/projectValidation';
import type { ProjectData, SaveConflict, SaveRequest, SaveResult } from '@shared/domain/types';
import { conflict, unprocessable } from '../errors';

export type CurrentProject = {
  version: number;
  savedBy: string;
  savedAt: Date;
  data: ProjectData;
};

const INITIAL_SUMMARY = 'Projeto criado';

/** Parses the stored JSON document, applying schema migrations when needed. */
export function parseStoredProject(json: string): ProjectData {
  const raw = JSON.parse(json) as unknown;
  return migrateProjectData(raw) as ProjectData;
}

/** Loads the current project row, or null when setup has not happened yet. */
export async function getCurrentProject(pool: Pool): Promise<CurrentProject | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT version, data, saved_by, saved_at FROM projects WHERE id = ?',
    [PROJECT_ID],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    version: Number(row.version),
    savedBy: String(row.saved_by),
    savedAt: new Date(row.saved_at as string | Date),
    data: parseStoredProject(String(row.data)),
  };
}

/** Creates the project row and its first version during setup. */
export async function createProject(conn: PoolConnection, data: ProjectData, savedBy: string, saveId: string): Promise<void> {
  const now = new Date();
  const json = JSON.stringify(data);
  await conn.execute('INSERT INTO projects (id, version, data, saved_by, saved_at) VALUES (?, ?, ?, ?, ?)', [
    PROJECT_ID,
    1,
    json,
    savedBy,
    now,
  ]);
  await conn.execute(
    `INSERT INTO project_versions (project_id, version, data, summary, saved_by, saved_at, save_id, overwrote_version)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
    [PROJECT_ID, 1, json, INITIAL_SUMMARY, savedBy, now, saveId],
  );
}

type ReplayRow = RowDataPacket & { version: number; saved_at: Date | string; summary: string };

/** Saves a new version with optimistic concurrency control; returns 200 data or throws 409/422 errors. */
export async function saveProject(pool: Pool, request: SaveRequest, savedBy: string): Promise<SaveResult> {
  const validation = validateProject(request.data);
  if (!validation.ok) {
    throw unprocessable('O projeto tem problemas e não pode ser salvo.', { problems: validation.problems });
  }
  const data = validation.data;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const replayed = await findReplay(conn, request.saveId);
    if (replayed) {
      await conn.rollback();
      return replayed;
    }
    const [rows] = await conn.execute<RowDataPacket[]>(
      'SELECT version, data, saved_by, saved_at FROM projects WHERE id = ? FOR UPDATE',
      [PROJECT_ID],
    );
    const current = rows[0];
    if (!current) {
      await conn.rollback();
      throw conflict('PROJECT_MISSING', 'O projeto ainda não foi criado. Acesse /setup.');
    }
    const currentVersion = Number(current.version);
    let overwroteVersion: number | null = null;
    if (currentVersion !== request.baseVersion) {
      if (!request.force || request.expectedVersion !== currentVersion) {
        const details = await buildConflict(conn, request.baseVersion, current);
        await conn.rollback();
        throw conflict('VERSION_CONFLICT', 'Existe uma versão mais nova.', details);
      }
      overwroteVersion = currentVersion;
    }
    const previous = parseStoredProject(String(current.data));
    const summary = summarizeChanges(previous, data);
    const newVersion = currentVersion + 1;
    const now = new Date();
    const json = JSON.stringify(data);
    try {
      await conn.execute(
        `INSERT INTO project_versions (project_id, version, data, summary, saved_by, saved_at, save_id, overwrote_version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [PROJECT_ID, newVersion, json, summary, savedBy, now, request.saveId, overwroteVersion],
      );
    } catch (error) {
      if (isDuplicateKey(error)) {
        await conn.rollback();
        const again = await findReplay(conn, request.saveId);
        if (again) return again;
      }
      throw error;
    }
    await conn.execute('UPDATE projects SET version = ?, data = ?, saved_by = ?, saved_at = ? WHERE id = ?', [
      newVersion,
      json,
      savedBy,
      now,
      PROJECT_ID,
    ]);
    await conn.execute('DELETE FROM project_versions WHERE project_id = ? AND version <= ?', [
      PROJECT_ID,
      newVersion - VERSION_HISTORY_LIMIT,
    ]);
    await conn.commit();
    return { version: newVersion, savedAt: now.toISOString(), summary, replayed: false };
  } catch (error) {
    await safeRollback(conn);
    throw error;
  } finally {
    conn.release();
  }
}

async function findReplay(conn: PoolConnection, saveId: string): Promise<SaveResult | null> {
  const [rows] = await conn.execute<ReplayRow[]>(
    'SELECT version, saved_at, summary FROM project_versions WHERE save_id = ?',
    [saveId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    version: Number(row.version),
    savedAt: new Date(row.saved_at).toISOString(),
    summary: String(row.summary),
    replayed: true,
  };
}

async function buildConflict(conn: PoolConnection, baseVersion: number, current: RowDataPacket): Promise<SaveConflict> {
  const [baseRows] = await conn.execute<RowDataPacket[]>(
    'SELECT data FROM project_versions WHERE project_id = ? AND version = ?',
    [PROJECT_ID, baseVersion],
  );
  let changesSinceBase: string | null = null;
  if (baseRows[0]) {
    const base = parseStoredProject(String(baseRows[0].data));
    const now = parseStoredProject(String(current.data));
    changesSinceBase = summarizeChanges(base, now);
  }
  return {
    currentVersion: Number(current.version),
    savedBy: String(current.saved_by),
    savedAt: new Date(current.saved_at as string | Date).toISOString(),
    changesSinceBase,
  };
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'ER_DUP_ENTRY';
}

async function safeRollback(conn: PoolConnection): Promise<void> {
  try {
    await conn.rollback();
  } catch {
    return;
  }
}
