import type {
  ApiErrorBody,
  ChangePasswordRequest,
  CreateShareLinkRequest,
  CreateUserRequest,
  LoginRequest,
  ProjectResponse,
  PublicProjectResponse,
  SaveResponse,
  SessionResponse,
  SetupRequest,
  SetupStatusResponse,
  ShareLinkCreatedResponse,
  ShareLinksResponse,
  UpdateUserRequest,
  UsersResponse,
  VersionResponse,
  VersionsResponse,
} from '@shared/api/schemas';
import { REQUEST_TIMEOUT_MS } from '@shared/config/defaults';
import type { SaveRequest, User } from '@shared/domain/types';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, requestId: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.details = details;
  }
}

export class NetworkError extends Error {
  readonly timedOut: boolean;

  constructor(message: string, timedOut: boolean) {
    super(message);
    this.name = 'NetworkError';
    this.timedOut = timedOut;
  }
}

const CSRF_HEADER = 'X-CSRF-Token';

const NETWORK_MESSAGE = 'Não foi possível falar com o servidor. Verifique a conexão.';

const TIMEOUT_MESSAGE = 'O servidor demorou demais para responder. Tente de novo.';

let csrfToken = '';

/** Stores the CSRF token sent with every non-GET request. */
export function setCsrfToken(token: string): void {
  csrfToken = token;
}

/** Returns the current CSRF token. */
export function getCsrfToken(): string {
  return csrfToken;
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

async function request<T>(method: Method, url: string, body?: unknown, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET' && csrfToken) headers[CSRF_HEADER] = csrfToken;
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
    });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === 'AbortError';
    throw new NetworkError(timedOut ? TIMEOUT_MESSAGE : NETWORK_MESSAGE, timedOut);
  } finally {
    clearTimeout(timer);
  }
  const text = await response.text();
  let parsed: unknown = null;
  if (text !== '') {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }
  if (!response.ok) {
    const errorBody = parsed as ApiErrorBody | null;
    const info = errorBody?.error;
    throw new ApiError(
      response.status,
      info?.code ?? 'HTTP_ERROR',
      info?.message ?? `Erro ${response.status}`,
      info?.requestId ?? '',
      info?.details,
    );
  }
  return parsed as T;
}

export const api = {
  setupStatus: () => request<SetupStatusResponse>('GET', '/api/setup'),
  setup: (body: SetupRequest) => request<SessionResponse>('POST', '/api/setup', body),
  login: (body: LoginRequest) => request<SessionResponse>('POST', '/api/auth/login', body),
  logout: () => request<{ ok: true }>('POST', '/api/auth/logout', {}),
  changePassword: (body: ChangePasswordRequest) => request<SessionResponse>('POST', '/api/auth/password', body),
  getProject: () => request<ProjectResponse>('GET', '/api/project'),
  saveProject: (body: SaveRequest) => request<SaveResponse>('PUT', '/api/project', body),
  listVersions: () => request<VersionsResponse>('GET', '/api/project/versions'),
  getVersion: (version: number) => request<VersionResponse>('GET', `/api/project/versions/${version}`),
  listUsers: () => request<UsersResponse>('GET', '/api/users'),
  createUser: (body: CreateUserRequest) => request<{ user: User }>('POST', '/api/users', body),
  updateUser: (id: string, body: UpdateUserRequest) => request<{ user: User }>('PATCH', `/api/users/${encodeURIComponent(id)}`, body),
  deleteUser: (id: string) => request<{ ok: true }>('DELETE', `/api/users/${encodeURIComponent(id)}`),
  listShareLinks: () => request<ShareLinksResponse>('GET', '/api/share-links'),
  createShareLink: (body: CreateShareLinkRequest) => request<ShareLinkCreatedResponse>('POST', '/api/share-links', body),
  revokeShareLink: (id: string) => request<{ ok: true }>('DELETE', `/api/share-links/${encodeURIComponent(id)}`),
  getPublic: (token: string) => request<PublicProjectResponse>('GET', `/api/public/${encodeURIComponent(token)}`),
};

export type Api = typeof api;

/** Extracts a user-facing message from any error thrown by the API client. */
export function errorMessage(error: unknown, fallback = 'Algo deu errado.'): string {
  if (error instanceof ApiError || error instanceof NetworkError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
