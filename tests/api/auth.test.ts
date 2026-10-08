import type { FastifyInstance } from 'fastify';
import type { Pool } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ADMIN, createTestApp, createTestPool, login, resetDatabase, runSetup, sampleProject, save, SESSION_COOKIE } from './helpers';

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

describe('auth', () => {
  it('setup only works once and logs the admin in', async () => {
    const auth = await runSetup(app);
    expect(auth.user.role).toBe('admin');
    const again = await app.inject({
      method: 'POST',
      url: '/api/setup',
      payload: { projectName: 'Outro', venue: { widthM: 10, depthM: 10 }, admin: ADMIN },
    });
    expect(again.statusCode).toBe(403);
    const status = await app.inject({ method: 'GET', url: '/api/setup' });
    expect(status.json()).toEqual({ needsSetup: false });
  });

  it('accepts a valid login and rejects a wrong password', async () => {
    await runSetup(app);
    const ok = await login(app, ADMIN.email, ADMIN.password);
    expect(ok.user.email).toBe(ADMIN.email);
    const bad = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: ADMIN.email, password: 'errada-123' } });
    expect(bad.statusCode).toBe(401);
    expect(bad.json().error.code).toBe('INVALID_CREDENTIALS');
  });

  it('blocks after 5 failed attempts', async () => {
    await runSetup(app);
    for (let i = 0; i < 5; i += 1) {
      const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: ADMIN.email, password: 'errada-123' } });
      expect(res.statusCode).toBe(401);
    }
    const blocked = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: ADMIN.email, password: ADMIN.password } });
    expect(blocked.statusCode).toBe(429);
  });

  it('returns 401 without a session', async () => {
    await runSetup(app);
    const res = await app.inject({ method: 'GET', url: '/api/project' });
    expect(res.statusCode).toBe(401);
    expect(res.body).not.toContain('guests');
    const versions = await app.inject({ method: 'GET', url: '/api/project/versions' });
    expect(versions.statusCode).toBe(401);
  });

  it('rejects a save without the CSRF header', async () => {
    const auth = await runSetup(app);
    const res = await save(app, auth, { baseVersion: 1, data: sampleProject() }, { csrf: false });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('CSRF_INVALID');
  });

  it('keeps the session valid after the app restarts', async () => {
    const auth = await runSetup(app);
    const restarted = await createTestApp(pool);
    try {
      const res = await restarted.inject({ method: 'GET', url: '/api/project', cookies: { [SESSION_COOKIE]: auth.cookie } });
      expect(res.statusCode).toBe(200);
      expect(res.json().project.version).toBe(1);
      expect(res.headers['cache-control']).toBe('no-store');
    } finally {
      await restarted.close();
    }
  });

  it('logout removes the session', async () => {
    const auth = await runSetup(app);
    const out = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      cookies: { [SESSION_COOKIE]: auth.cookie },
      headers: { 'x-csrf-token': auth.csrfToken },
    });
    expect(out.statusCode).toBe(200);
    const res = await app.inject({ method: 'GET', url: '/api/project', cookies: { [SESSION_COOKIE]: auth.cookie } });
    expect(res.statusCode).toBe(401);
  });

  it('changes the password and clears the provisional flag', async () => {
    const auth = await runSetup(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/password',
      cookies: { [SESSION_COOKIE]: auth.cookie },
      headers: { 'x-csrf-token': auth.csrfToken },
      payload: { currentPassword: ADMIN.password, newPassword: 'outra-senha-456' },
    });
    expect(res.statusCode).toBe(200);
    const relogin = await login(app, ADMIN.email, 'outra-senha-456');
    expect(relogin.user.mustChangePassword).toBe(false);
  });
});
