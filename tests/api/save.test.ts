import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { VersionsResponse } from '@shared/api/schemas';
import { createTable } from '@shared/domain/seating';
import { ADMIN, createTestApp, createTestPool, loadProject, login, resetDatabase, runSetup, sampleProject, save, SESSION_COOKIE, type Auth } from './helpers';

let pool: Pool;
let app: FastifyInstance;

beforeAll(async () => {
  pool = await createTestPool();
  app = await createTestApp(pool);
});

afterAll(async () => {
  await app.close();
  await pool.end();
});

beforeEach(async () => {
  await resetDatabase(pool);
});

async function createEditor(auth: Auth, name: string, email: string): Promise<Auth> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/users',
    cookies: { [SESSION_COOKIE]: auth.cookie },
    headers: { 'x-csrf-token': auth.csrfToken },
    payload: { name, email, password: 'senha-editor-123', role: 'editor' },
  });
  expect(res.statusCode).toBe(201);
  return login(app, email, 'senha-editor-123');
}

describe('save', () => {
  it('saves when baseVersion matches and increments the version', async () => {
    const auth = await runSetup(app);
    const res = await save(app, auth, { baseVersion: 1, data: sampleProject(2) });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.version).toBe(2);
    expect(body.summary).toBe('2 mesas adicionadas');
    expect(body.replayed).toBe(false);
    const loaded = await loadProject(app, auth);
    expect(loaded.project.version).toBe(2);
    expect(loaded.project.savedBy).toBe(ADMIN.name);
    expect(loaded.project.data.tables).toHaveLength(2);
  });

  it('responds 409 with author, time and summary when baseVersion is stale', async () => {
    const bride = await runSetup(app);
    const groom = await createEditor(bride, 'Noivo', 'noivo@exemplo.com');
    const first = await save(app, bride, { baseVersion: 1, data: sampleProject(2) });
    expect(first.statusCode).toBe(200);
    const res = await save(app, groom, { baseVersion: 1, data: sampleProject(1) });
    expect(res.statusCode).toBe(409);
    const details = res.json().error.details;
    expect(details.currentVersion).toBe(2);
    expect(details.savedBy).toBe('Noiva');
    expect(typeof details.savedAt).toBe('string');
    expect(details.changesSinceBase).toBe('2 mesas adicionadas');
  });

  it('force with the right expectedVersion saves and records overwrote_version', async () => {
    const bride = await runSetup(app);
    const groom = await createEditor(bride, 'Noivo', 'noivo@exemplo.com');
    await save(app, bride, { baseVersion: 1, data: sampleProject(2) });
    const res = await save(app, groom, { baseVersion: 1, data: sampleProject(3), force: true, expectedVersion: 2 });
    expect(res.statusCode).toBe(200);
    expect(res.json().version).toBe(3);
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT overwrote_version FROM project_versions WHERE version = 3');
    expect(Number(rows[0].overwrote_version)).toBe(2);
    const versions = await app.inject({ method: 'GET', url: '/api/project/versions', cookies: { [SESSION_COOKIE]: groom.cookie } });
    const list = versions.json<VersionsResponse>();
    expect(list.versions[0].overwroteVersion).toBe(2);
    expect(list.versions[0].overwroteSavedBy).toBe('Noiva');
    expect(list.versions.some((v) => v.version === 2)).toBe(true);
  });

  it('force with a stale expectedVersion responds 409 with the newer data', async () => {
    const bride = await runSetup(app);
    const groom = await createEditor(bride, 'Noivo', 'noivo@exemplo.com');
    await save(app, bride, { baseVersion: 1, data: sampleProject(2) });
    await save(app, bride, { baseVersion: 2, data: sampleProject(3) });
    const res = await save(app, groom, { baseVersion: 1, data: sampleProject(1), force: true, expectedVersion: 2 });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.details.currentVersion).toBe(3);
  });

  it('a repeated saveId returns the same version without duplicating', async () => {
    const auth = await runSetup(app);
    const saveId = randomUUID();
    const first = await save(app, auth, { saveId, baseVersion: 1, data: sampleProject(2) });
    expect(first.statusCode).toBe(200);
    const again = await save(app, auth, { saveId, baseVersion: 1, data: sampleProject(2) });
    expect(again.statusCode).toBe(200);
    expect(again.json().version).toBe(2);
    expect(again.json().replayed).toBe(true);
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT COUNT(*) AS total FROM project_versions');
    expect(Number(rows[0].total)).toBe(2);
  });

  it('rejects an invalid document with 422', async () => {
    const auth = await runSetup(app);
    const data = sampleProject(2);
    data.guests = [{ id: 'g1', name: 'Ana' }];
    data.tables[0].seats[0].guestId = 'g1';
    data.tables[1].seats[0].guestId = 'g1';
    const res = await save(app, auth, { baseVersion: 1, data });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.details.problems.join(' ')).toContain('dois assentos');

    const over = sampleProject(1);
    over.guests = Array.from({ length: 11 }, (_, i) => ({ id: `g${i}`, name: `C ${i}` }));
    over.tables[0].seats = over.tables[0].seats.map((s, i) => ({ ...s, guestId: `g${i}` }));
    over.tables[0].seats.push({ index: 10, side: 'top', enabled: true, guestId: 'g10' });
    const res2 = await save(app, auth, { baseVersion: 1, data: over });
    expect(res2.statusCode).toBe(422);
  });

  it('keeps at most 100 versions', async () => {
    const auth = await runSetup(app);
    let version = 1;
    for (let i = 0; i < 104; i += 1) {
      const data = sampleProject(1);
      data.tables[0] = { ...data.tables[0], x: 3 + (i % 10) * 0.1 };
      const res = await save(app, auth, { baseVersion: version, data });
      expect(res.statusCode).toBe(200);
      version = res.json().version;
    }
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT COUNT(*) AS total, MIN(version) AS oldest FROM project_versions');
    expect(Number(rows[0].total)).toBe(100);
    expect(Number(rows[0].oldest)).toBe(6);
  });

  it('a version loaded from history can be saved as a new version', async () => {
    const auth = await runSetup(app);
    await save(app, auth, { baseVersion: 1, data: sampleProject(2) });
    await save(app, auth, { baseVersion: 2, data: sampleProject(3) });
    const old = await app.inject({ method: 'GET', url: '/api/project/versions/2', cookies: { [SESSION_COOKIE]: auth.cookie } });
    expect(old.statusCode).toBe(200);
    const data = old.json().data;
    data.tables.push(createTable('extra', 'square', { x: 15, y: 10 }, 'Mesa 9'));
    const res = await save(app, auth, { baseVersion: 3, data });
    expect(res.statusCode).toBe(200);
    expect(res.json().version).toBe(4);
  });
});
