import type { Pool, RowDataPacket } from 'mysql2/promise';
import { LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MINUTES } from '@shared/config/defaults';

const WINDOW_MS = LOGIN_WINDOW_MINUTES * 60 * 1000;

/** Returns true when the email/IP pair reached the failed-login limit inside the window. */
export async function isLoginBlocked(pool: Pool, email: string, ip: string): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS);
  await pool.execute('DELETE FROM login_attempts WHERE email = ? AND ip = ? AND attempted_at < ?', [email, ip, since]);
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT COUNT(*) AS total FROM login_attempts WHERE email = ? AND ip = ? AND attempted_at >= ?',
    [email, ip, since],
  );
  return Number(rows[0]?.total ?? 0) >= LOGIN_MAX_ATTEMPTS;
}

/** Records a failed login attempt. */
export async function recordFailedLogin(pool: Pool, email: string, ip: string): Promise<void> {
  await pool.execute('INSERT INTO login_attempts (email, ip, attempted_at) VALUES (?, ?, ?)', [email, ip, new Date()]);
}

/** Clears failed attempts after a successful login. */
export async function clearLoginAttempts(pool: Pool, email: string, ip: string): Promise<void> {
  await pool.execute('DELETE FROM login_attempts WHERE email = ? AND ip = ?', [email, ip]);
}
