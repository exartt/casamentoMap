import type { Pool, RowDataPacket } from 'mysql2/promise';
import { MIGRATIONS_TABLE_SQL, migrations } from './migrations';

const LOCK_NAME = 'planejador_mesas_migrations';

const LOCK_TIMEOUT_SECONDS = 30;

type Logger = { info: (msg: string) => void; warn: (msg: string) => void };

/** Applies pending migrations under a MySQL named lock, recording each one in schema_migrations. */
export async function runMigrations(pool: Pool, log: Logger): Promise<number> {
  const conn = await pool.getConnection();
  let applied = 0;
  try {
    const [lockRows] = await conn.query<RowDataPacket[]>('SELECT GET_LOCK(?, ?) AS got', [LOCK_NAME, LOCK_TIMEOUT_SECONDS]);
    if (Number(lockRows[0]?.got) !== 1) throw new Error('Não foi possível obter a trava de migração do banco.');
    try {
      await conn.query(MIGRATIONS_TABLE_SQL);
      const [rows] = await conn.query<RowDataPacket[]>('SELECT version FROM schema_migrations');
      const done = new Set(rows.map((r) => Number(r.version)));
      for (const migration of migrations) {
        if (done.has(migration.version)) continue;
        log.info(`Aplicando migração ${migration.version} (${migration.name})`);
        for (const statement of migration.statements) await conn.query(statement);
        await conn.execute('INSERT INTO schema_migrations (version) VALUES (?)', [migration.version]);
        applied += 1;
      }
    } finally {
      await conn.query('SELECT RELEASE_LOCK(?)', [LOCK_NAME]);
    }
  } finally {
    conn.release();
  }
  return applied;
}

/** Renders the full schema as SQL text, used to generate database/schema.sql. */
export function renderSchemaSql(): string {
  const parts = [MIGRATIONS_TABLE_SQL + ';'];
  for (const migration of migrations) {
    parts.push(`-- Migração ${migration.version}: ${migration.name}`);
    for (const statement of migration.statements) parts.push(statement + ';');
    parts.push(`INSERT IGNORE INTO schema_migrations (version) VALUES (${migration.version});`);
  }
  return `-- Schema gerado a partir de src/server/db/migrations. Não edite à mão: rode npm run schema:sql.\n\n${parts.join('\n\n')}\n`;
}
