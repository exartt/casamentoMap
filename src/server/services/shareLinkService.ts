import { randomUUID } from 'node:crypto';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { PROJECT_ID } from '@shared/config/defaults';
import type { ShareLinkInfo } from '@shared/api/schemas';
import { generateToken, hashToken } from '../auth/sessions';

function toInfo(row: RowDataPacket): ShareLinkInfo {
  return {
    id: String(row.id),
    label: String(row.label),
    createdBy: String(row.created_by),
    createdAt: new Date(row.created_at as string | Date).toISOString(),
    revokedAt: row.revoked_at ? new Date(row.revoked_at as string | Date).toISOString() : null,
  };
}

/** Lists share links of the project, newest first. */
export async function listShareLinks(pool: Pool): Promise<ShareLinkInfo[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT id, label, created_by, created_at, revoked_at FROM share_links WHERE project_id = ? ORDER BY created_at DESC',
    [PROJECT_ID],
  );
  return rows.map(toInfo);
}

/** Creates a share link and returns the raw token once; only its hash is stored. */
export async function createShareLink(pool: Pool, label: string, createdBy: string): Promise<{ link: ShareLinkInfo; token: string }> {
  const id = randomUUID();
  const token = generateToken();
  const now = new Date();
  await pool.execute(
    'INSERT INTO share_links (id, project_id, token_hash, label, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, PROJECT_ID, hashToken(token), label, createdBy, now],
  );
  return { link: { id, label, createdBy, createdAt: now.toISOString(), revokedAt: null }, token };
}

/** Marks a share link as revoked; returns false when it does not exist. */
export async function revokeShareLink(pool: Pool, id: string): Promise<boolean> {
  const [result] = await pool.execute('UPDATE share_links SET revoked_at = ? WHERE id = ? AND project_id = ? AND revoked_at IS NULL', [
    new Date(),
    id,
    PROJECT_ID,
  ]);
  return (result as { affectedRows?: number }).affectedRows === 1;
}

/** Returns true when the raw token belongs to an active share link. */
export async function isShareTokenActive(pool: Pool, token: string): Promise<boolean> {
  if (!/^[0-9a-f]{64}$/.test(token)) return false;
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT id FROM share_links WHERE token_hash = ? AND project_id = ? AND revoked_at IS NULL',
    [hashToken(token), PROJECT_ID],
  );
  return rows.length > 0;
}
