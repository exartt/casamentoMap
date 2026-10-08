import type { FastifyInstance } from 'fastify';
import { saveRequestSchema, type ProjectResponse, type SaveResponse } from '@shared/api/schemas';
import type { SaveRequest } from '@shared/domain/types';
import { requireAuth } from '../auth/guards';
import { notFound, unauthorized, unprocessable } from '../errors';
import { getCurrentProject, saveProject } from '../services/projectService';

/** Routes that load and save the project document. */
export async function projectRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/project', { preHandler: [requireAuth] }, async (request): Promise<ProjectResponse> => {
    const session = request.session;
    if (!session) throw unauthorized();
    const current = await getCurrentProject(app.pool);
    if (!current) throw notFound('O projeto ainda não foi criado.');
    return {
      user: session.user,
      csrfToken: session.csrfToken,
      project: {
        version: current.version,
        savedBy: current.savedBy,
        savedAt: current.savedAt.toISOString(),
        data: current.data,
      },
    };
  });

  app.put('/api/project', { preHandler: [requireAuth] }, async (request): Promise<SaveResponse> => {
    const session = request.session;
    if (!session) throw unauthorized();
    const parsed = saveRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      const problems = parsed.error.issues.slice(0, 20).map((i) => `${i.path.join('.') || 'corpo'}: ${i.message}`);
      throw unprocessable('O projeto tem problemas e não pode ser salvo.', { problems });
    }
    const body = parsed.data as SaveRequest;
    const result = await saveProject(app.pool, body, session.user.name);
    return { version: result.version, savedAt: result.savedAt, summary: result.summary, replayed: result.replayed };
  });
}
