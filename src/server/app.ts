import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fastifyCookie from '@fastify/cookie';
import fastifyHelmet from '@fastify/helmet';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyError, type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import type { Pool } from 'mysql2/promise';
import type { ApiErrorBody } from '@shared/api/schemas';
import { BODY_LIMIT_BYTES } from '@shared/config/defaults';
import { CSRF_HEADER, csrfTokenMatches } from './auth/csrf';
import { loadSession, SESSION_COOKIE, type SessionInfo } from './auth/sessions';
import type { Env } from './env';
import { AppError } from './errors';
import { authRoutes } from './routes/auth';
import { healthRoutes } from './routes/health';
import { projectRoutes } from './routes/project';
import { publicViewRoutes } from './routes/publicView';
import { setupRoutes } from './routes/setup';
import { shareLinkRoutes } from './routes/shareLinks';
import { userRoutes } from './routes/users';
import { versionRoutes } from './routes/versions';

declare module 'fastify' {
  interface FastifyInstance {
    pool: Pool;
    env: Env;
  }
  interface FastifyRequest {
    session: SessionInfo | null;
  }
}

export type BuildAppOptions = {
  env: Env;
  pool: Pool;
  staticRoot?: string | null;
};

const API_PREFIX = '/api';

const CSRF_EXEMPT_ROUTES = new Set(['/api/setup', '/api/auth/login']);

const ASSETS_PREFIX = '/assets/';

const ASSETS_CACHE = 'public, max-age=31536000, immutable';

const NO_CACHE = 'no-cache';

const NO_STORE = 'no-store';

const INDEX_FILE = 'index.html';

/** Finds the built client directory, looking next to the bundle and in the working directory. */
export function resolveStaticRoot(): string | null {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [path.resolve(moduleDir, '../client'), path.resolve(process.cwd(), 'dist/client')];
  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, INDEX_FILE))) return candidate;
  }
  return null;
}

/** Builds the Fastify application with plugins, hooks, routes and static files. */
export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const { env, pool } = options;
  const staticRoot = options.staticRoot === undefined ? resolveStaticRoot() : options.staticRoot;

  const app = Fastify({
    logger: {
      level: env.logLevel,
      redact: { paths: ['req.headers.cookie', 'req.headers.authorization', 'req.headers["x-csrf-token"]'], censor: '[oculto]' },
    },
    trustProxy: true,
    bodyLimit: BODY_LIMIT_BYTES,
    genReqId: () => randomUUID(),
  });

  app.decorate('pool', pool);
  app.decorate('env', env);
  app.decorateRequest('session', null);

  await app.register(fastifyCookie);
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: env.isProduction ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
  });

  app.addHook('onRequest', async (request, reply) => {
    if (env.forceHttps && request.protocol !== 'https') {
      const host = request.headers.host ?? request.hostname;
      reply.redirect(`https://${host}${request.url}`, 301);
      return reply;
    }
    if (!request.url.startsWith(API_PREFIX)) return;
    const token = request.cookies[SESSION_COOKIE];
    request.session = token ? await loadSession(pool, token) : null;
  });

  app.addHook('preHandler', async (request) => {
    if (!request.url.startsWith(API_PREFIX)) return;
    if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') return;
    const routePath = request.url.split('?')[0];
    if (CSRF_EXEMPT_ROUTES.has(routePath)) return;
    if (routePath.startsWith('/api/public/')) return;
    if (!request.session) throw new AppError(401, 'UNAUTHORIZED', 'É preciso entrar para continuar.');
    if (!csrfTokenMatches(request.headers[CSRF_HEADER], request.session.csrfToken)) {
      throw new AppError(403, 'CSRF_INVALID', 'Sessão inválida para esta ação. Recarregue a página e tente de novo.');
    }
  });

  app.addHook('onSend', async (request, reply, payload) => {
    reply.header('X-Robots-Tag', 'noindex, nofollow');
    if (request.url.startsWith(API_PREFIX)) reply.header('Cache-Control', NO_STORE);
    else if (request.url.startsWith(ASSETS_PREFIX)) reply.header('Cache-Control', ASSETS_CACHE);
    else reply.header('Cache-Control', NO_CACHE);
    return payload;
  });

  app.setErrorHandler((error: FastifyError | AppError | Error, request: FastifyRequest, reply: FastifyReply) => {
    const requestId = String(request.id);
    if (error instanceof AppError) {
      const body: ApiErrorBody = { error: { code: error.code, message: error.message, requestId } };
      if (error.details !== undefined) body.error.details = error.details;
      reply.code(error.statusCode).send(body);
      return;
    }
    const statusCode = (error as FastifyError).statusCode;
    if (statusCode && statusCode >= 400 && statusCode < 500) {
      const message = statusCode === 413 ? 'O projeto é grande demais para ser enviado.' : 'Requisição inválida.';
      const body: ApiErrorBody = { error: { code: (error as FastifyError).code ?? 'BAD_REQUEST', message, requestId } };
      reply.code(statusCode).send(body);
      return;
    }
    request.log.error({ err: error, requestId }, 'erro interno');
    const body: ApiErrorBody = {
      error: { code: 'INTERNAL_ERROR', message: 'Ocorreu um erro inesperado. Tente de novo em instantes.', requestId },
    };
    reply.code(500).send(body);
  });

  await app.register(setupRoutes);
  await app.register(authRoutes);
  await app.register(projectRoutes);
  await app.register(versionRoutes);
  await app.register(userRoutes);
  await app.register(shareLinkRoutes);
  await app.register(publicViewRoutes);
  await app.register(healthRoutes);

  if (staticRoot) {
    await app.register(fastifyStatic, {
      root: staticRoot,
      prefix: '/',
      index: [INDEX_FILE],
      serveDotFiles: false,
      cacheControl: false,
    });
  }

  app.setNotFoundHandler((request, reply) => {
    const requestId = String(request.id);
    if (request.url.startsWith(API_PREFIX)) {
      const body: ApiErrorBody = { error: { code: 'NOT_FOUND', message: 'Rota não encontrada.', requestId } };
      reply.code(404).send(body);
      return;
    }
    if (staticRoot && (request.method === 'GET' || request.method === 'HEAD')) {
      reply.type('text/html; charset=utf-8').sendFile(INDEX_FILE);
      return;
    }
    reply.code(404).type('text/plain; charset=utf-8').send('Página não encontrada.');
  });

  return app;
}
