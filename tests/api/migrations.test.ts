import type { Pool, RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runMigrations } from '@server/db/migrate';
import { createTestPool } from './helpers';

let pool: Pool;

beforeAll(async () => {
  pool = await createTestPool();
});

afterAll(async () => {
  await pool.end();
});

describe('migrations', () => {
  it('running twice applies nothing new and keeps the schema', async () => {
    const log = { info: () => undefined, warn: () => undefined };
    const first = await runMigrations(pool, log);
    const second = await runMigrations(pool, log);
    expect(first).toBe(0);
    expect(second).toBe(0);
    const [rows] = await pool.query<RowDataPacket[]>('SELECT version FROM schema_migrations ORDER BY version');
    expect(rows.map((r) => Number(r.version))).toEqual([1]);
    const [tables] = await pool.query<RowDataPacket[]>("SHOW TABLES LIKE 'project_versions'");
    expect(tables).toHaveLength(1);
  });
});
