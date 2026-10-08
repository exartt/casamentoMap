import { timingSafeEqual } from 'node:crypto';

export const CSRF_HEADER = 'x-csrf-token';

/** Compares the header token with the session token in constant time. */
export function csrfTokenMatches(headerValue: string | string[] | undefined, sessionToken: string): boolean {
  const value = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (!value || value.length !== sessionToken.length) return false;
  return timingSafeEqual(Buffer.from(value), Buffer.from(sessionToken));
}
