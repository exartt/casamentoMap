import type { DoorKind, FixtureKind, TableKind } from '@shared/domain/types';

export const GUEST_DRAG_TYPE = 'application/x-guest-id';

export const PALETTE_DRAG_TYPE = 'application/x-palette-item';

export type PaletteItem =
  | { type: 'table'; kind: TableKind; couple?: boolean }
  | { type: 'fixture'; kind: FixtureKind }
  | { type: 'door'; kind: DoorKind };
