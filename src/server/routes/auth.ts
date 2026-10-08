import type { FastifyInstance } from 'fastify';
import { changePasswordRequestSchema, loginRequestSchema, type SessionResponse } from '@shared/api/schemas';
import { LOGIN_WINDOW_MINUTES } from '@shared/config/defaults';
import { requireAuth } from '../auth/guards';
import { hashPassword, verifyPassword } from '../auth/passwords';
import { clearLoginAttempts, isLoginBlocked, recordFailedLogin } from '../auth/rateLimit';
import {
  createSession,
  deleteSession,
  deleteUserSessions,
  purgeExpiredSessions,
  SESSION_COOKIE,
  sessionCookieOptions,
} from '../auth/sessions';
import { AppError, tooManyRequests } from '../errors';
import { findUserByEmail, findUserById } from '../services/userService';
import { parseBody } from '../validation';

/** Login, logout and password change routes. */
export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/auth/login', async (request, reply): Promise<SessionResponse> => {
    const body = parseBody(loginRequestSchema, request.body);
    const ip = request.ip;
    if (await isLoginBlocked(app.pool, body.email, ip)) {
      throw tooManyRequests(`Muitas tentativas. Aguarde ${LOGIN_WINDOW_MINUTES} minutos e tente de novo.`);
    }
    const user = await findUserByEmail(app.pool, body.email);
    const valid = user ? await verifyPassword(body.password, user.passwordHash) : false;
    if (!user || !valid) {
      await recordFailedLogin(app.pool, body.email, ip);
      throw new AppError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos.');
    }
    await clearLoginAttempts(app.pool, body.email, ip);
    await purgeExpiredSessions(app.pool);
    const session = await createSession(app.pool, user.id);
    reply.setCookie(SESSION_COOKIE, session.token, sessionCookieOptions(app.env.isProduction));
    return {
      user: { id: user.id, name: user.name, email: user.email, role: user.role, mustChangePassword: user.mustChangePassword },
      csrfToken: session.csrfToken,
    };
  });

  app.post('/api/auth/logout', { preHandler: [requireAuth] }, async (request, reply): Promise<{ ok: true }> => {
    const session = request.session;
    if (session) await deleteSession(app.pool, session.tokenHash);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  app.post('/api/auth/password', { preHandler: [requireAuth] }, async (request): Promise<SessionResponse> => {
    const session = request.session;
    if (!session) throw new AppError(401, 'UNAUTHORIZED', 'É preciso entrar para continuar.');
    const body = parseBody(changePasswordRequestSchema, request.body);
    const user = await findUserById(app.pool, session.user.id);
    if (!user) throw new AppError(401, 'UNAUTHORIZED', 'Usuário não encontrado.');
    const valid = await verifyPassword(body.currentPassword, user.passwordHash);
    if (!valid) throw new AppError(400, 'WRONG_PASSWORD', 'A senha atual está incorreta.');
    if (body.currentPassword === body.newPassword) {
      throw new AppError(400, 'SAME_PASSWORD', 'A nova senha precisa ser diferente da atual.');
    }
    const passwordHash = await hashPassword(body.newPassword);
    await app.pool.execute('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?', [passwordHash, user.id]);
    await deleteUserSessions(app.pool, user.id, session.tokenHash);
    return {
      user: { ...session.user, mustChangePassword: false },
      csrfToken: session.csrfToken,
    };
  });
}
