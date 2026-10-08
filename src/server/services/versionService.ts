import type { Pool, RowDataPacket } from 'mysql2/promise';
import { PROJECT_ID } from '@shared/config/defaults';
import type { ProjectData, SavedVersion } from '@shared/domain/types';
import { parseStoredProject } from './projectService';

function toSavedVersion(row: RowDataPacket): SavedVersion {
  return {
    version: Number(row.version),
    savedBy: String(row.saved_by),
    savedAt: new Date(row.saved_at as string | Date).toISOString(),
    summary: String(row.summary),
    overwroteVersion: row.overwrote_version === null || row.overwrote_version === undefined ? null : Number(row.overwrote_version),
    overwroteSavedBy: row.overwrote_saved_by === null || row.overwrote_saved_by === undefined ? null : String(row.overwrote_saved_by),
  };
}

/** Lists the stored versions, newest first, with the author of any overwritten version. */
export async function listVersions(pool: Pool): Promise<SavedVersion[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT v.version, v.saved_by, v.saved_at, v.summary, v.overwrote_version, o.saved_by AS overwrote_saved_by
       FROM project_versions v
       LEFT JOIN project_versions o ON o.project_id = v.project_id AND o.version = v.overwrote_version
      WHERE v.project_id = ?
      ORDER BY v.version DESC`,
    [PROJECT_ID],
  );
  return rows.map(toSavedVersion);
}

/** Loads one version with its document, or null. */
export async function getVersion(pool: Pool, version: number): Promise<(SavedVersion & { data: ProjectData }) | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT v.version, v.saved_by, v.saved_at, v.summary, v.overwrote_version, v.data, o.saved_by AS overwrote_saved_by
       FROM project_versions v
       LEFT JOIN project_versions o ON o.project_id = v.project_id AND o.version = v.overwrote_version
      WHERE v.project_id = ? AND v.version = ?`,
    [PROJECT_ID, version],
  );
  const row = rows[0];
  if (!row) return null;
  return { ...toSavedVersion(row), data: parseStoredProject(String(row.data)) };
}
