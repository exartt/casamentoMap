import type { FastifyInstance } from 'fastify';
import type { PublicProjectResponse } from '@shared/api/schemas';
import { notFound } from '../errors';
import { getCurrentProject } from '../services/projectService';
import { isShareTokenActive } from '../services/shareLinkService';

/** Read-only route used by the share link page; exposes only guest ids and names. */
export async function publicViewRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { token: string } }>('/api/public/:token', async (request): Promise<PublicProjectResponse> => {
    const active = await isShareTokenActive(app.pool, request.params.token);
    if (!active) throw notFound('Este link não existe ou foi revogado.');
    const current = await getCurrentProject(app.pool);
    if (!current) throw notFound('O projeto ainda não foi criado.');
    const { guests, ...rest } = current.data;
    return {
      name: current.data.name,
      version: current.version,
      savedAt: current.savedAt.toISOString(),
      data: { ...rest, guests: guests.map((g) => ({ id: g.id, name: g.name })) },
    };
  });
}
