import { z } from 'zod';
import { LIMITS, SNAP_STEPS_M } from '../config/defaults';

const idSchema = z.string().min(1).max(64);

const meters = z.number().finite();

const elementSize = meters.min(LIMITS.minElementM).max(LIMITS.maxElementM);

const rotation = z.number().finite().min(-360).max(360);

export const venueSchema = z.object({
  widthM: meters.min(LIMITS.minVenueM).max(LIMITS.maxVenueM),
  depthM: meters.min(LIMITS.minVenueM).max(LIMITS.maxVenueM),
});

export const seatSchema = z.object({
  index: z.number().int().min(0),
  side: z.enum(['top', 'right', 'bottom', 'left']),
  enabled: z.boolean(),
  guestId: idSchema.nullable(),
});

export const tableSchema = z.object({
  id: idSchema,
  kind: z.enum(['banquet', 'square']),
  label: z.string().min(1).max(LIMITS.maxLabelLength),
  x: meters,
  y: meters,
  rotation,
  widthM: elementSize,
  depthM: elementSize,
  seats: z.array(seatSchema).max(50),
  highlight: z.boolean(),
  locked: z.boolean(),
  notes: z.string().max(LIMITS.maxNotesLength).optional(),
});

export const guestSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(LIMITS.maxNameLength),
  group: z.string().max(LIMITS.maxLabelLength).optional(),
  side: z.enum(['bride', 'groom', 'both']).optional(),
  isChild: z.boolean().optional(),
  dietary: z.string().max(LIMITS.maxNotesLength).optional(),
  notes: z.string().max(LIMITS.maxNotesLength).optional(),
});

export const fixtureSchema = z.object({
  id: idSchema,
  kind: z.enum(['bar', 'stage', 'danceFloor', 'dessertTable', 'cakeTable', 'tree', 'buffet', 'custom']),
  label: z.string().min(1).max(LIMITS.maxLabelLength),
  shape: z.enum(['rect', 'circle']),
  x: meters,
  y: meters,
  rotation,
  widthM: elementSize,
  depthM: elementSize,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  blocksPlacement: z.boolean(),
  locked: z.boolean(),
});

export const doorSchema = z.object({
  id: idSchema,
  kind: z.enum(['main', 'service', 'emergency']),
  label: z.string().min(1).max(LIMITS.maxLabelLength),
  wall: z.enum(['top', 'right', 'bottom', 'left']),
  offsetM: meters.min(0).max(LIMITS.maxVenueM),
  widthM: elementSize,
});

export const settingsSchema = z.object({
  showGrid: z.boolean(),
  snapEnabled: z.boolean(),
  snapStepM: z.number().refine((v) => (SNAP_STEPS_M as readonly number[]).includes(v), {
    message: 'Passo de encaixe inválido',
  }),
  minAisleM: meters.min(0).max(10),
  doorClearanceM: meters.min(0).max(10),
  preventOverlap: z.boolean(),
});

export const projectDataSchema = z.object({
  schemaVersion: z.number().int().min(1),
  name: z.string().min(1).max(LIMITS.maxProjectNameLength),
  venue: venueSchema,
  tables: z.array(tableSchema).max(LIMITS.maxTables),
  fixtures: z.array(fixtureSchema).max(LIMITS.maxFixtures),
  doors: z.array(doorSchema).max(LIMITS.maxDoors),
  guests: z.array(guestSchema).max(LIMITS.maxGuests),
  settings: settingsSchema,
});

export type ProjectDataInput = z.input<typeof projectDataSchema>;
