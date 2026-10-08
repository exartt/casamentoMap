import type {
  DoorKind,
  FixtureKind,
  FixtureShape,
  SeatSide,
  Settings,
  TableKind,
  Venue,
} from '../domain/types';

export const SCHEMA_VERSION = 1;

export const PROJECT_ID = 1;

export const VERSION_HISTORY_LIMIT = 100;

export const LIMITS = {
  maxGuests: 3000,
  maxTables: 300,
  maxFixtures: 300,
  maxDoors: 50,
  maxNameLength: 120,
  maxLabelLength: 60,
  maxNotesLength: 500,
  maxProjectNameLength: 120,
  minVenueM: 2,
  maxVenueM: 200,
  minElementM: 0.3,
  maxElementM: 60,
} as const;

export const DEFAULT_VENUE: Venue = { widthM: 20, depthM: 14 };

export const DEFAULT_SETTINGS: Settings = {
  showGrid: true,
  snapEnabled: true,
  snapStepM: 0.25,
  minAisleM: 0.9,
  doorClearanceM: 1.5,
  preventOverlap: false,
};

export const SNAP_STEPS_M = [0.1, 0.25, 0.5] as const;

export const SEAT_SIZE_M = 0.45;

export const SEAT_GAP_M = 0.1;

export const SEAT_OFFSET_M = SEAT_GAP_M + SEAT_SIZE_M / 2;

export type TableSpec = {
  capacity: number;
  defaultWidthM: number;
  defaultDepthM: number;
  seatsPerSide: Record<SeatSide, number>;
  labelPt: string;
};

export const TABLE_SPECS: Record<TableKind, TableSpec> = {
  banquet: {
    capacity: 10,
    defaultWidthM: 2.8,
    defaultDepthM: 1.0,
    seatsPerSide: { top: 5, right: 0, bottom: 5, left: 0 },
    labelPt: 'Banquete',
  },
  square: {
    capacity: 8,
    defaultWidthM: 1.4,
    defaultDepthM: 1.4,
    seatsPerSide: { top: 2, right: 2, bottom: 2, left: 2 },
    labelPt: 'Normal',
  },
};

export const SEAT_SIDE_ORDER: SeatSide[] = ['top', 'right', 'bottom', 'left'];

export const TABLE_LABEL_PREFIX = 'Mesa';

export const COUPLE_TABLE_LABEL = 'Mesa dos Noivos';

export type FixtureSpec = {
  labelPt: string;
  shape: FixtureShape;
  defaultWidthM: number;
  defaultDepthM: number;
  color: string;
  canUnblock: boolean;
};

export const FIXTURE_SPECS: Record<FixtureKind, FixtureSpec> = {
  bar: { labelPt: 'Bar', shape: 'rect', defaultWidthM: 4, defaultDepthM: 1.5, color: '#8b5e3c', canUnblock: false },
  stage: { labelPt: 'Palco/DJ', shape: 'rect', defaultWidthM: 5, defaultDepthM: 3, color: '#6b4c9a', canUnblock: false },
  danceFloor: { labelPt: 'Pista de dança', shape: 'rect', defaultWidthM: 6, defaultDepthM: 6, color: '#d9c8a9', canUnblock: false },
  dessertTable: { labelPt: 'Mesa de doces', shape: 'rect', defaultWidthM: 3, defaultDepthM: 1, color: '#c9607a', canUnblock: false },
  cakeTable: { labelPt: 'Mesa do bolo', shape: 'rect', defaultWidthM: 1.2, defaultDepthM: 0.8, color: '#e0a7b7', canUnblock: false },
  tree: { labelPt: 'Árvore central', shape: 'circle', defaultWidthM: 1.5, defaultDepthM: 1.5, color: '#3f7d4e', canUnblock: false },
  buffet: { labelPt: 'Buffet', shape: 'rect', defaultWidthM: 4, defaultDepthM: 1, color: '#b7791f', canUnblock: false },
  custom: { labelPt: 'Área personalizada', shape: 'rect', defaultWidthM: 3, defaultDepthM: 2, color: '#7aa6c2', canUnblock: true },
};

export const FIXTURE_PALETTE_ORDER: FixtureKind[] = [
  'bar',
  'stage',
  'danceFloor',
  'dessertTable',
  'cakeTable',
  'tree',
  'buffet',
  'custom',
];

export const UNDER_TABLE_FIXTURES: FixtureKind[] = ['danceFloor', 'custom'];

export type DoorSpec = { labelPt: string; color: string; shortLabel: string };

export const DOOR_SPECS: Record<DoorKind, DoorSpec> = {
  main: { labelPt: 'Porta principal', color: '#2b6cb0', shortLabel: 'P' },
  service: { labelPt: 'Porta de serviço', color: '#718096', shortLabel: 'S' },
  emergency: { labelPt: 'Saída de emergência', color: '#c53030', shortLabel: 'E' },
};

export const DEFAULT_DOOR_WIDTH_M = 1.2;

export const WALL_THICKNESS_M = 0.15;

export const ROTATION_SNAP_DEG = 15;

export const KEYBOARD_MOVE_STEP_M = 0.1;

export const KEYBOARD_MOVE_STEP_LARGE_M = 0.5;

export const KEYBOARD_ROTATE_STEP_DEG = 90;

export const ZOOM_MIN = 0.1;

export const ZOOM_MAX = 4;

export const PX_PER_M = 40;

export const UNDO_HISTORY_LIMIT = 100;

export const DRAFT_DEBOUNCE_MS = 1000;

export const REQUEST_TIMEOUT_MS = 20000;

export const PASSWORD_MIN_LENGTH = 8;

export const SESSION_TTL_DAYS = 30;

export const LOGIN_MAX_ATTEMPTS = 5;

export const LOGIN_WINDOW_MINUTES = 15;

export const BODY_LIMIT_BYTES = 5 * 1024 * 1024;

export const DB_POOL_SIZE = 5;

export const EXPORT_PIXEL_RATIO = 3;

export const CSV_PREVIEW_ROWS = 20;

export const RENUMBER_ROW_TOLERANCE_M = 1.0;

export const GROUP_COLORS = [
  '#2b6cb0',
  '#c05621',
  '#2f855a',
  '#6b46c1',
  '#b83280',
  '#d69e2e',
  '#319795',
  '#c53030',
  '#4a5568',
  '#3182ce',
  '#805ad5',
  '#dd6b20',
] as const;

export const NO_GROUP_COLOR = '#718096';
