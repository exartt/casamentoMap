import { z } from 'zod';
import { LIMITS, PASSWORD_MIN_LENGTH } from '../config/defaults';
import { projectDataSchema, venueSchema } from '../domain/projectSchema';
import type { ProjectData, SaveConflict, SavedVersion, User } from '../domain/types';

export const emailSchema = z.string().trim().toLowerCase().email().max(254);

export const passwordSchema = z.string().min(PASSWORD_MIN_LENGTH).max(200);

export const personNameSchema = z.string().trim().min(1).max(LIMITS.maxNameLength);

export const setupRequestSchema = z.object({
  projectName: z.string().trim().min(1).max(LIMITS.maxProjectNameLength),
  venue: venueSchema,
  admin: z.object({
    name: personNameSchema,
    email: emailSchema,
    password: passwordSchema,
  }),
});

export type SetupRequest = z.infer<typeof setupRequestSchema>;

export const loginRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const changePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: passwordSchema,
});

export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;

export const saveRequestSchema = z.object({
  saveId: z.string().uuid(),
  baseVersion: z.number().int().min(0),
  data: projectDataSchema,
  force: z.boolean().optional(),
  expectedVersion: z.number().int().min(0).optional(),
});

export const createUserRequestSchema = z.object({
  name: personNameSchema,
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(['admin', 'editor']),
});

export type CreateUserRequest = z.infer<typeof createUserRequestSchema>;

export const updateUserRequestSchema = z
  .object({
    name: personNameSchema.optional(),
    role: z.enum(['admin', 'editor']).optional(),
    password: passwordSchema.optional(),
  })
  .refine((v) => v.name !== undefined || v.role !== undefined || v.password !== undefined, {
    message: 'Nada para alterar',
  });

export type UpdateUserRequest = z.infer<typeof updateUserRequestSchema>;

export const createShareLinkRequestSchema = z.object({
  label: z.string().trim().min(1).max(LIMITS.maxLabelLength),
});

export type CreateShareLinkRequest = z.infer<typeof createShareLinkRequestSchema>;

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: unknown;
  };
};

export type ProjectInfo = {
  version: number;
  savedBy: string;
  savedAt: string;
};

export type ProjectResponse = {
  user: User;
  csrfToken: string;
  project: ProjectInfo & { data: ProjectData };
};

export type SaveResponse = {
  version: number;
  savedAt: string;
  summary: string;
  replayed: boolean;
};

export type SaveConflictResponse = ApiErrorBody & { error: { details: SaveConflict } };

export type SessionResponse = {
  user: User;
  csrfToken: string;
};

export type SetupStatusResponse = { needsSetup: boolean };

export type VersionsResponse = { versions: SavedVersion[]; currentVersion: number };

export type VersionResponse = SavedVersion & { data: ProjectData };

export type UsersResponse = { users: User[] };

export type ShareLinkInfo = {
  id: string;
  label: string;
  createdBy: string;
  createdAt: string;
  revokedAt: string | null;
};

export type ShareLinksResponse = { links: ShareLinkInfo[] };

export type ShareLinkCreatedResponse = { link: ShareLinkInfo; token: string; url: string };

export type PublicGuest = { id: string; name: string };

export type PublicProjectResponse = {
  name: string;
  version: number;
  savedAt: string;
  data: Omit<ProjectData, 'guests'> & { guests: PublicGuest[] };
};

export type HealthResponse = { ok: true; uptimeSeconds: number };
