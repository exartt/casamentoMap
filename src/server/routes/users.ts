import type { FastifyInstance } from 'fastify';
import { createUserRequestSchema, updateUserRequestSchema, type UsersResponse } from '@shared/api/schemas';
import type { User } from '@shared/domain/types';
import { requireAdmin } from '../auth/guards';
import { deleteUserSessions } from '../auth/sessions';
import { AppError, badRequest, conflict, notFound, unauthorized } from '../errors';
import { countAdmins, createUser, deleteUser, findUserById, listUsers, updateUser } from '../services/userService';
import { parseBody } from '../validation';

function isDuplicateKey(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'ER_DUP_ENTRY';
}

/** Admin routes that manage the people with access. */
export async function userRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/users', { preHandler: [requireAdmin] }, async (): Promise<UsersResponse> => {
    return { users: await listUsers(app.pool) };
  });

  app.post('/api/users', { preHandler: [requireAdmin] }, async (request, reply): Promise<{ user: User }> => {
    const body = parseBody(createUserRequestSchema, request.body);
    try {
      const user = await createUser(app.pool, { ...body, mustChangePassword: true });
      reply.code(201);
      return { user };
    } catch (error) {
      if (isDuplicateKey(error)) throw conflict('EMAIL_IN_USE', 'Já existe uma pessoa com esse e-mail.');
      throw error;
    }
  });

  app.patch<{ Params: { id: string } }>('/api/users/:id', { preHandler: [requireAdmin] }, async (request): Promise<{ user: User }> => {
    const session = request.session;
    if (!session) throw unauthorized();
    const body = parseBody(updateUserRequestSchema, request.body);
    const target = await findUserById(app.pool, request.params.id);
    if (!target) throw notFound('Pessoa não encontrada.');
    if (body.role === 'editor' && target.role === 'admin' && (await countAdmins(app.pool)) <= 1) {
      throw badRequest('É preciso manter pelo menos um administrador.');
    }
    await updateUser(app.pool, target.id, {
      name: body.name,
      role: body.role,
      password: body.password,
      mustChangePassword: body.password !== undefined ? true : undefined,
    });
    if (body.password !== undefined) {
      await deleteUserSessions(app.pool, target.id, target.id === session.user.id ? session.tokenHash : undefined);
    }
    const updated = await findUserById(app.pool, target.id);
    if (!updated) throw notFound('Pessoa não encontrada.');
    return {
      user: { id: updated.id, name: updated.name, email: updated.email, role: updated.role, mustChangePassword: updated.mustChangePassword },
    };
  });

  app.delete<{ Params: { id: string } }>('/api/users/:id', { preHandler: [requireAdmin] }, async (request): Promise<{ ok: true }> => {
    const session = request.session;
    if (!session) throw unauthorized();
    if (request.params.id === session.user.id) throw new AppError(400, 'CANNOT_DELETE_SELF', 'Você não pode remover a si mesmo.');
    const target = await findUserById(app.pool, request.params.id);
    if (!target) throw notFound('Pessoa não encontrada.');
    if (target.role === 'admin' && (await countAdmins(app.pool)) <= 1) {
      throw badRequest('É preciso manter pelo menos um administrador.');
    }
    await deleteUser(app.pool, target.id);
    return { ok: true };
  });
}
