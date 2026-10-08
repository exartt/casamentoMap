import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { setupRequestSchema, type SessionResponse, type SetupStatusResponse } from '@shared/api/schemas';
import { createEmptyProject } from '@shared/domain/projectMigration';
import { createSession, SESSION_COOKIE, sessionCookieOptions } from '../auth/sessions';
import { forbidden } from '../errors';
import { createProject } from '../services/projectService';
import { countUsers, createUser } from '../services/userService';
import { parseBody } from '../validation';

/** Routes that create the project and the first administrator. */
export async function setupRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/setup', async (): Promise<SetupStatusResponse> => {
    const total = await countUsers(app.pool);
    return { needsSetup: total === 0 };
  });

  app.post('/api/setup', async (request, reply): Promise<SessionResponse> => {
    const body = parseBody(setupRequestSchema, request.body);
    const conn = await app.pool.getConnection();
    let userId: string;
    try {
      await conn.beginTransaction();
      await conn.query('SELECT 1 FROM users LIMIT 1 FOR UPDATE');
      const total = await countUsers(conn);
      if (total > 0) {
        await conn.rollback();
        throw forbidden('A configuração inicial já foi feita.', 'SETUP_DONE');
      }
      const user = await createUser(conn, {
        name: body.admin.name,
        email: body.admin.email,
        password: body.admin.password,
        role: 'admin',
        mustChangePassword: false,
      });
      userId = user.id;
      const data = createEmptyProject(body.projectName, body.venue);
      await createProject(conn, data, user.name, randomUUID());
      await conn.commit();
    } catch (error) {
      try {
        await conn.rollback();
      } catch {
        request.log.warn('rollback do setup falhou');
      }
      throw error;
    } finally {
      conn.release();
    }
    const session = await createSession(app.pool, userId);
    reply.setCookie(SESSION_COOKIE, session.token, sessionCookieOptions(app.env.isProduction));
    return {
      user: { id: userId, name: body.admin.name, email: body.admin.email, role: 'admin', mustChangePassword: false },
      csrfToken: session.csrfToken,
    };
  });
}
