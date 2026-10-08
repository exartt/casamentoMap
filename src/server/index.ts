import { existsSync } from 'node:fs';
import path from 'node:path';
import { buildApp } from './app';
import { runMigrations } from './db/migrate';
import { createPool } from './db/pool';
import { loadEnv } from './env';

const SHUTDOWN_TIMEOUT_MS = 10000;

const ENV_FILE = '.env';

/** Loads a local .env file when present; variables already set in the environment win. */
function loadDotEnv(): void {
  const file = path.resolve(process.cwd(), ENV_FILE);
  if (existsSync(file)) process.loadEnvFile(file);
}

/** Boots the server: environment, pool, migrations, app and listen, with graceful shutdown. */
async function main(): Promise<void> {
  loadDotEnv();
  const env = loadEnv();
  const pool = createPool(env.db);
  const app = await buildApp({ env, pool });
  const log = {
    info: (msg: string) => app.log.info(msg),
    warn: (msg: string) => app.log.warn(msg),
  };
  const applied = await runMigrations(pool, log);
  if (applied > 0) app.log.info(`${applied} migração(ões) aplicada(s)`);

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info(`${signal} recebido, encerrando`);
    const timer = setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS);
    try {
      await app.close();
      await pool.end();
      clearTimeout(timer);
      process.exit(0);
    } catch (error) {
      app.log.error({ err: error }, 'erro ao encerrar');
      process.exit(1);
    }
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  await app.listen({ port: env.port, host: env.host });
}

main().catch((error: unknown) => {
  console.error('Falha ao iniciar o servidor:', error);
  process.exit(1);
});
