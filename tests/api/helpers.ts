import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'mysql2/promise';
import { buildApp } from '@server/app';
import { runMigrations } from '@server/db/migrate';
import { createPool } from '@server/db/pool';
import { loadEnv, type Env } from '@server/env';
import type { ProjectResponse, SessionResponse } from '@shared/api/schemas';
import { createEmptyProject } from '@shared/domain/projectMigration';
import { createTable } from '@shared/domain/seating';
import type { ProjectData } from '@shared/domain/types';

export const SESSION_COOKIE = 'mesas_session';

export const ADMIN = { name: 'Noiva', email: 'noiva@exemplo.com', password: 'senha-forte-123' };

const silentLog = { info: () => undefined, warn: () => undefined };

/** Builds the env for tests from TEST_DB_* variables with local defaults. */
export function testEnv(): Env {
  return loadEnv({
    NODE_ENV: 'test',
    DB_HOST: process.env.TEST_DB_HOST ?? '127.0.0.1',
    DB_PORT: process.env.TEST_DB_PORT ?? '3306',
    DB_NAME: process.env.TEST_DB_NAME ?? 'mesas_test',
    DB_USER: process.env.TEST_DB_USER ?? 'mesas',
    DB_PASSWORD: process.env.TEST_DB_PASSWORD ?? 'mesas',
    FORCE_HTTPS: 'false',
    APP_URL: 'http://localhost:3000',
  });
}

/** Creates a pool for the test database and applies migrations. */
export async function createTestPool(): Promise<Pool> {
  const env = testEnv();
  const pool = createPool(env.db);
  await runMigrations(pool, silentLog);
  return pool;
}

/** Empties every table so each test starts from a clean database. */
export async function resetDatabase(pool: Pool): Promise<void> {
  await pool.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of ['share_links', 'project_versions', 'projects', 'login_attempts', 'sessions', 'users']) {
    await pool.query(`TRUNCATE TABLE ${table}`);
  }
  await pool.query('SET FOREIGN_KEY_CHECKS = 1');
}

/** Builds an app instance bound to the test pool, without static files. */
export async function createTestApp(pool: Pool): Promise<FastifyInstance> {
  const app = await buildApp({ env: testEnv(), pool, staticRoot: null });
  await app.ready();
  return app;
}

export type Auth = { cookie: string; csrfToken: string; user: SessionResponse['user'] };

function cookieFromResponse(setCookie: string | string[] | undefined): string {
  const list = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const match = list.map((c) => /mesas_session=([^;]+)/.exec(c)).find((m) => m !== null);
  if (!match) throw new Error('Cookie de sessão ausente');
  return match[1];
}

/** Runs the setup endpoint and returns the admin's authentication. */
export async function runSetup(app: FastifyInstance, overrides: Partial<typeof ADMIN> = {}): Promise<Auth> {
  const admin = { ...ADMIN, ...overrides };
  const res = await app.inject({
    method: 'POST',
    url: '/api/setup',
    payload: { projectName: 'Casamento Teste', venue: { widthM: 20, depthM: 14 }, admin },
  });
  if (res.statusCode !== 200) throw new Error(`setup falhou: ${res.statusCode} ${res.body}`);
  const body = res.json<SessionResponse>();
  return { cookie: cookieFromResponse(res.headers['set-cookie']), csrfToken: body.csrfToken, user: body.user };
}

/** Logs a user in and returns the authentication. */
export async function login(app: FastifyInstance, email: string, password: string): Promise<Auth> {
  const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password } });
  if (res.statusCode !== 200) throw new Error(`login falhou: ${res.statusCode} ${res.body}`);
  const body = res.json<SessionResponse>();
  return { cookie: cookieFromResponse(res.headers['set-cookie']), csrfToken: body.csrfToken, user: body.user };
}

/** Loads the current project through the API. */
export async function loadProject(app: FastifyInstance, auth: Auth): Promise<ProjectResponse> {
  const res = await app.inject({ method: 'GET', url: '/api/project', cookies: { [SESSION_COOKIE]: auth.cookie } });
  if (res.statusCode !== 200) throw new Error(`GET /api/project falhou: ${res.statusCode} ${res.body}`);
  return res.json<ProjectResponse>();
}

/** Sends a save request with the given auth. */
export async function save(
  app: FastifyInstance,
  auth: Auth,
  body: { saveId?: string; baseVersion: number; data: ProjectData; force?: boolean; expectedVersion?: number },
  options: { csrf?: boolean } = {},
) {
  const headers: Record<string, string> = {};
  if (options.csrf !== false) headers['x-csrf-token'] = auth.csrfToken;
  return app.inject({
    method: 'PUT',
    url: '/api/project',
    cookies: { [SESSION_COOKIE]: auth.cookie },
    headers,
    payload: { saveId: body.saveId ?? randomUUID(), ...body },
  });
}

/** Produces a project document with the given number of tables, for save tests. */
export function sampleProject(tables = 1): ProjectData {
  const p = createEmptyProject('Casamento Teste');
  p.tables = Array.from({ length: tables }, (_, i) =>
    createTable(`t${i + 1}`, 'banquet', { x: 3 + i * 4, y: 3 }, `Mesa ${i + 1}`),
  );
  return p;
}
