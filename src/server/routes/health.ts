import type { FastifyInstance } from 'fastify';
import type { HealthResponse } from '@shared/api/schemas';

/** Liveness route without database access or data. */
export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/health', async (): Promise<HealthResponse> => {
    return { ok: true, uptimeSeconds: Math.round(process.uptime()) };
  });
}
