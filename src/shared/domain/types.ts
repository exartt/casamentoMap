export type Venue = { widthM: number; depthM: number };

export type TableKind = 'banquet' | 'square';

export type SeatSide = 'top' | 'right' | 'bottom' | 'left';

export type Seat = {
  index: number;
  side: SeatSide;
  enabled: boolean;
  guestId: string | null;
};

export type Table = {
  id: string;
  kind: TableKind;
  label: string;
  x: number;
  y: number;
  rotation: number;
  widthM: number;
  depthM: number;
  seats: Seat[];
  highlight: boolean;
  locked: boolean;
  notes?: string;
};

export type GuestSide = 'bride' | 'groom' | 'both';

export type Guest = {
  id: string;
  name: string;
  group?: string;
  side?: GuestSide;
  isChild?: boolean;
  dietary?: string;
  notes?: string;
};

export type FixtureKind =
  | 'bar'
  | 'stage'
  | 'danceFloor'
  | 'dessertTable'
  | 'cakeTable'
  | 'tree'
  | 'buffet'
  | 'custom';

export type FixtureShape = 'rect' | 'circle';

export type Fixture = {
  id: string;
  kind: FixtureKind;
  label: string;
  shape: FixtureShape;
  x: number;
  y: number;
  rotation: number;
  widthM: number;
  depthM: number;
  color: string;
  blocksPlacement: boolean;
  locked: boolean;
};

export type DoorKind = 'main' | 'service' | 'emergency';

export type Wall = 'top' | 'right' | 'bottom' | 'left';

export type Door = {
  id: string;
  kind: DoorKind;
  label: string;
  wall: Wall;
  offsetM: number;
  widthM: number;
};

export type Settings = {
  showGrid: boolean;
  snapEnabled: boolean;
  snapStepM: number;
  minAisleM: number;
  doorClearanceM: number;
  preventOverlap: boolean;
};

export type ProjectData = {
  schemaVersion: number;
  name: string;
  venue: Venue;
  tables: Table[];
  fixtures: Fixture[];
  doors: Door[];
  guests: Guest[];
  settings: Settings;
};

export type UserRole = 'admin' | 'editor';

export type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  mustChangePassword: boolean;
};

export type SavedVersion = {
  version: number;
  savedBy: string;
  savedAt: string;
  summary: string;
  overwroteVersion: number | null;
  overwroteSavedBy?: string | null;
};

export type SaveRequest = {
  saveId: string;
  baseVersion: number;
  data: ProjectData;
  force?: boolean;
  expectedVersion?: number;
};

export type SaveConflict = {
  currentVersion: number;
  savedBy: string;
  savedAt: string;
  changesSinceBase: string | null;
};

export type SaveResult = {
  version: number;
  savedAt: string;
  summary: string;
  replayed: boolean;
};

export type ElementRef =
  | { type: 'table'; id: string }
  | { type: 'fixture'; id: string }
  | { type: 'door'; id: string };
