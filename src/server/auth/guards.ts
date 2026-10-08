import type { FastifyReply, FastifyRequest } from 'fastify';
import { forbidden, unauthorized } from '../errors';

/** Pre-handler that rejects requests without a valid session. */
export async function requireAuth(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  if (!request.session) throw unauthorized();
}

/** Pre-handler that rejects requests from non-admin users. */
export async function requireAdmin(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  if (!request.session) throw unauthorized();
  if (request.session.user.role !== 'admin') throw forbidden('Só administradores podem fazer isso.');
}
