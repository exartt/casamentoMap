import { z } from 'zod';
import { DB_POOL_SIZE } from '@shared/config/defaults';

const boolFromString = z
  .string()
  .optional()
  .transform((v) => (v === undefined ? undefined : !['0', 'false', 'no', 'off'].includes(v.toLowerCase())));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().default('0.0.0.0'),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().default(''),
  DB_POOL_SIZE: z.coerce.number().int().min(1).max(DB_POOL_SIZE).default(DB_POOL_SIZE),
  APP_URL: z.string().url().optional(),
  FORCE_HTTPS: boolFromString,
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
});

export type Env = {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  host: string;
  db: { host: string; port: number; name: string; user: string; password: string; poolSize: number };
  appUrl: string | null;
  forceHttps: boolean;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
  isProduction: boolean;
};

/** Parses and validates environment variables into a typed config object. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Configuração de ambiente inválida: ${problems}`);
  }
  const e = parsed.data;
  const isProduction = e.NODE_ENV === 'production';
  return {
    nodeEnv: e.NODE_ENV,
    port: e.PORT,
    host: e.HOST,
    db: {
      host: e.DB_HOST,
      port: e.DB_PORT,
      name: e.DB_NAME,
      user: e.DB_USER,
      password: e.DB_PASSWORD,
      poolSize: e.DB_POOL_SIZE,
    },
    appUrl: e.APP_URL ? e.APP_URL.replace(/\/+$/, '') : null,
    forceHttps: e.FORCE_HTTPS ?? isProduction,
    logLevel: e.LOG_LEVEL ?? (isProduction ? 'info' : e.NODE_ENV === 'test' ? 'silent' : 'debug'),
    isProduction,
  };
}
