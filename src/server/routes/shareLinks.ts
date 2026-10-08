import type { FastifyInstance } from 'fastify';
import { createShareLinkRequestSchema, type ShareLinkCreatedResponse, type ShareLinksResponse } from '@shared/api/schemas';
import { requireAdmin } from '../auth/guards';
import { notFound, unauthorized } from '../errors';
import { createShareLink, listShareLinks, revokeShareLink } from '../services/shareLinkService';
import { parseBody } from '../validation';

export const PUBLIC_VIEW_PATH = '/ver/';

/** Admin routes that manage read-only share links. */
export async function shareLinkRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/share-links', { preHandler: [requireAdmin] }, async (): Promise<ShareLinksResponse> => {
    return { links: await listShareLinks(app.pool) };
  });

  app.post('/api/share-links', { preHandler: [requireAdmin] }, async (request, reply): Promise<ShareLinkCreatedResponse> => {
    const session = request.session;
    if (!session) throw unauthorized();
    const body = parseBody(createShareLinkRequestSchema, request.body);
    const { link, token } = await createShareLink(app.pool, body.label, session.user.name);
    const origin = app.env.appUrl ?? `${request.protocol}://${request.headers.host ?? request.hostname}`;
    reply.code(201);
    return { link, token, url: `${origin}${PUBLIC_VIEW_PATH}${token}` };
  });

  app.delete<{ Params: { id: string } }>('/api/share-links/:id', { preHandler: [requireAdmin] }, async (request): Promise<{ ok: true }> => {
    const revoked = await revokeShareLink(app.pool, request.params.id);
    if (!revoked) throw notFound('Link não encontrado ou já revogado.');
    return { ok: true };
  });
}
