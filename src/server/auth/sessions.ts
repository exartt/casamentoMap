import { createHash, randomBytes } from 'node:crypto';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { SESSION_TTL_DAYS } from '@shared/config/defaults';
import type { User } from '@shared/domain/types';

export const SESSION_COOKIE = 'mesas_session';

const TOKEN_BYTES = 32;

const RENEW_AFTER_MS = 60 * 60 * 1000;

const TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

export type SessionInfo = { tokenHash: string; csrfToken: string; user: User };

/** Hashes a token with SHA-256 so the database never stores raw tokens. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Generates a random token of 32 bytes as hex. */
export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString('hex');
}

/** Creates a session row for a user and returns the raw token to put in the cookie. */
export async function createSession(pool: Pool, userId: string): Promise<{ token: string; csrfToken: string }> {
  const token = generateToken();
  const csrfToken = generateToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TTL_MS);
  await pool.execute(
    'INSERT INTO sessions (token_hash, user_id, csrf_token, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)',
    [hashToken(token), userId, csrfToken, now, expiresAt, now],
  );
  return { token, csrfToken };
}

/** Loads the session for a raw cookie token, renewing its expiry when it was last seen a while ago. */
export async function loadSession(pool: Pool, token: string): Promise<SessionInfo | null> {
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const tokenHash = hashToken(token);
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT s.token_hash, s.csrf_token, s.expires_at, s.last_seen_at,
            u.id, u.name, u.email, u.role, u.must_change_password
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?`,
    [tokenHash],
  );
  const row = rows[0];
  if (!row) return null;
  const expiresAt = new Date(row.expires_at as string | Date);
  if (expiresAt.getTime() <= Date.now()) {
    await pool.execute('DELETE FROM sessions WHERE token_hash = ?', [tokenHash]);
    return null;
  }
  const lastSeen = new Date(row.last_seen_at as string | Date);
  if (Date.now() - lastSeen.getTime() > RENEW_AFTER_MS) {
    await pool.execute('UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE token_hash = ?', [
      new Date(),
      new Date(Date.now() + TTL_MS),
      tokenHash,
    ]);
  }
  return {
    tokenHash,
    csrfToken: String(row.csrf_token),
    user: {
      id: String(row.id),
      name: String(row.name),
      email: String(row.email),
      role: row.role === 'admin' ? 'admin' : 'editor',
      mustChangePassword: Number(row.must_change_password) === 1,
    },
  };
}

/** Deletes a session by its token hash. */
export async function deleteSession(pool: Pool, tokenHash: string): Promise<void> {
  await pool.execute('DELETE FROM sessions WHERE token_hash = ?', [tokenHash]);
}

/** Deletes every session of a user, used when the user is removed or the password is reset. */
export async function deleteUserSessions(pool: Pool, userId: string, keepTokenHash?: string): Promise<void> {
  if (keepTokenHash) {
    await pool.execute('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?', [userId, keepTokenHash]);
  } else {
    await pool.execute('DELETE FROM sessions WHERE user_id = ?', [userId]);
  }
}

/** Removes expired sessions; called opportunistically on login. */
export async function purgeExpiredSessions(pool: Pool): Promise<void> {
  await pool.execute('DELETE FROM sessions WHERE expires_at < ?', [new Date()]);
}

/** Cookie options shared by login and logout. */
export function sessionCookieOptions(secure: boolean): {
  path: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax';
  maxAge: number;
} {
  return {
    path: '/',
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: Math.floor(TTL_MS / 1000),
  };
}
