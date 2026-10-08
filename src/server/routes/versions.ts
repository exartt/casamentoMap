import type { FastifyInstance } from 'fastify';
import type { VersionResponse, VersionsResponse } from '@shared/api/schemas';
import { requireAuth } from '../auth/guards';
import { badRequest, notFound } from '../errors';
import { getCurrentProject } from '../services/projectService';
import { getVersion, listVersions } from '../services/versionService';

/** Routes that expose the version history. */
export async function versionRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/project/versions', { preHandler: [requireAuth] }, async (): Promise<VersionsResponse> => {
    const [versions, current] = await Promise.all([listVersions(app.pool), getCurrentProject(app.pool)]);
    return { versions, currentVersion: current ? current.version : 0 };
  });

  app.get<{ Params: { version: string } }>(
    '/api/project/versions/:version',
    { preHandler: [requireAuth] },
    async (request): Promise<VersionResponse> => {
      const version = Number(request.params.version);
      if (!Number.isInteger(version) || version < 1) throw badRequest('Número de versão inválido.');
      const found = await getVersion(app.pool, version);
      if (!found) throw notFound('Essa versão não está mais no histórico.');
      return found;
    },
  );
}
