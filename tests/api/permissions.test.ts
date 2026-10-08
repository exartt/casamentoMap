import type { FastifyInstance } from 'fastify';
import type { Pool } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, createTestPool, login, resetDatabase, runSetup, SESSION_COOKIE } from './helpers';

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

describe('permissions and share links', () => {
  it('an editor cannot access admin routes', async () => {
    const admin = await runSetup(app);
    const created = await app.inject({
      method: 'POST',
      url: '/api/users',
      cookies: { [SESSION_COOKIE]: admin.cookie },
      headers: { 'x-csrf-token': admin.csrfToken },
      payload: { name: 'Assessora', email: 'assessora@exemplo.com', password: 'senha-prov-123', role: 'editor' },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().user.mustChangePassword).toBe(true);
    const editor = await login(app, 'assessora@exemplo.com', 'senha-prov-123');
    const users = await app.inject({ method: 'GET', url: '/api/users', cookies: { [SESSION_COOKIE]: editor.cookie } });
    expect(users.statusCode).toBe(403);
    const links = await app.inject({
      method: 'POST',
      url: '/api/share-links',
      cookies: { [SESSION_COOKIE]: editor.cookie },
      headers: { 'x-csrf-token': editor.csrfToken },
      payload: { label: 'Equipe' },
    });
    expect(links.statusCode).toBe(403);
    const project = await app.inject({ method: 'GET', url: '/api/project', cookies: { [SESSION_COOKIE]: editor.cookie } });
    expect(project.statusCode).toBe(200);
  });

  it('share links expose only names and stop working after revocation', async () => {
    const admin = await runSetup(app);
    const created = await app.inject({
      method: 'POST',
      url: '/api/share-links',
      cookies: { [SESSION_COOKIE]: admin.cookie },
      headers: { 'x-csrf-token': admin.csrfToken },
      payload: { label: 'Equipe do dia' },
    });
    expect(created.statusCode).toBe(201);
    const { token, link, url } = created.json();
    expect(url).toContain(`/ver/${token}`);
    const pub = await app.inject({ method: 'GET', url: `/api/public/${token}` });
    expect(pub.statusCode).toBe(200);
    expect(pub.json().data.guests).toEqual([]);
    const revoked = await app.inject({
      method: 'DELETE',
      url: `/api/share-links/${link.id}`,
      cookies: { [SESSION_COOKIE]: admin.cookie },
      headers: { 'x-csrf-token': admin.csrfToken },
    });
    expect(revoked.statusCode).toBe(200);
    const after = await app.inject({ method: 'GET', url: `/api/public/${token}` });
    expect(after.statusCode).toBe(404);
  });

  it('health responds without data', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
  });
});
