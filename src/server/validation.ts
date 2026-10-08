import type { ZodType } from 'zod';
import { badRequest } from './errors';

/** Parses a request body with a zod schema, raising a 400 error with the issues when invalid. */
export function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `${i.path.join('.') || 'corpo'}: ${i.message}`);
    throw badRequest('Dados inválidos.', { problems });
  }
  return result.data;
}
