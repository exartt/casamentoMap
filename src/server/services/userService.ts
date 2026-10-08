import { randomUUID } from 'node:crypto';
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import type { User, UserRole } from '@shared/domain/types';
import { hashPassword } from '../auth/passwords';

type Queryable = Pool | PoolConnection;

function toUser(row: RowDataPacket): User {
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    role: row.role === 'admin' ? 'admin' : 'editor',
    mustChangePassword: Number(row.must_change_password) === 1,
  };
}

/** Counts registered users; zero means setup has not run. */
export async function countUsers(db: Queryable): Promise<number> {
  const [rows] = await db.execute<RowDataPacket[]>('SELECT COUNT(*) AS total FROM users');
  return Number(rows[0]?.total ?? 0);
}

/** Lists users ordered by name. */
export async function listUsers(db: Queryable): Promise<User[]> {
  const [rows] = await db.execute<RowDataPacket[]>(
    'SELECT id, name, email, role, must_change_password FROM users ORDER BY name',
  );
  return rows.map(toUser);
}

/** Finds a user with the password hash by email. */
export async function findUserByEmail(db: Queryable, email: string): Promise<(User & { passwordHash: string }) | null> {
  const [rows] = await db.execute<RowDataPacket[]>(
    'SELECT id, name, email, role, must_change_password, password_hash FROM users WHERE email = ?',
    [email],
  );
  const row = rows[0];
  return row ? { ...toUser(row), passwordHash: String(row.password_hash) } : null;
}

/** Finds a user with the password hash by id. */
export async function findUserById(db: Queryable, id: string): Promise<(User & { passwordHash: string }) | null> {
  const [rows] = await db.execute<RowDataPacket[]>(
    'SELECT id, name, email, role, must_change_password, password_hash FROM users WHERE id = ?',
    [id],
  );
  const row = rows[0];
  return row ? { ...toUser(row), passwordHash: String(row.password_hash) } : null;
}

/** Inserts a user and returns it. */
export async function createUser(
  db: Queryable,
  input: { name: string; email: string; password: string; role: UserRole; mustChangePassword: boolean },
): Promise<User> {
  const id = randomUUID();
  const passwordHash = await hashPassword(input.password);
  await db.execute(
    'INSERT INTO users (id, name, email, password_hash, role, must_change_password, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, input.name, input.email, passwordHash, input.role, input.mustChangePassword ? 1 : 0, new Date()],
  );
  return { id, name: input.name, email: input.email, role: input.role, mustChangePassword: input.mustChangePassword };
}

/** Updates name, role and/or password (a password set by an admin forces a change at next login). */
export async function updateUser(
  db: Queryable,
  id: string,
  changes: { name?: string; role?: UserRole; password?: string; mustChangePassword?: boolean },
): Promise<void> {
  const sets: string[] = [];
  const params: Array<string | number> = [];
  if (changes.name !== undefined) {
    sets.push('name = ?');
    params.push(changes.name);
  }
  if (changes.role !== undefined) {
    sets.push('role = ?');
    params.push(changes.role);
  }
  if (changes.password !== undefined) {
    sets.push('password_hash = ?');
    params.push(await hashPassword(changes.password));
  }
  if (changes.mustChangePassword !== undefined) {
    sets.push('must_change_password = ?');
    params.push(changes.mustChangePassword ? 1 : 0);
  }
  if (sets.length === 0) return;
  params.push(id);
  await db.execute(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params);
}

/** Deletes a user; sessions are removed by the foreign key cascade. */
export async function deleteUser(db: Queryable, id: string): Promise<void> {
  await db.execute('DELETE FROM users WHERE id = ?', [id]);
}

/** Counts admins, used to keep at least one. */
export async function countAdmins(db: Queryable): Promise<number> {
  const [rows] = await db.execute<RowDataPacket[]>("SELECT COUNT(*) AS total FROM users WHERE role = 'admin'");
  return Number(rows[0]?.total ?? 0);
}
