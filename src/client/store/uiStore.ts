import { create } from 'zustand';
import type { ElementRef } from '@shared/domain/types';

export type PanelTab = 'guests' | 'properties' | 'warnings' | 'versions';

export type Viewport = { zoom: number; x: number; y: number };

export type DropTarget = { tableId: string; seatIndex: number | null; refused: boolean };

export type DialogName =
  | 'settings'
  | 'importGuests'
  | 'importProject'
  | 'users'
  | 'shareLinks'
  | 'changePassword'
  | 'shortcuts'
  | 'tableList'
  | null;

export type UiState = {
  activeTab: PanelTab;
  viewport: Viewport;
  stageSize: { width: number; height: number };
  cursorM: { x: number; y: number } | null;
  hoverTableId: string | null;
  dropTarget: DropTarget | null;
  draggingGuestId: string | null;
  dragDelta: { id: string; dx: number; dy: number } | null;
  dragInfo: {
    ref: ElementRef;
    bounds: { x: number; y: number; width: number; height: number };
    left: number;
    right: number;
    top: number;
    bottom: number;
  } | null;
  selectionRect: { x1: number; y1: number; x2: number; y2: number } | null;
  focusRequest: { ref: ElementRef; seatIndex: number | null; nonce: number } | null;
  flashTableId: string | null;
  canvasSearch: string;
  eventMode: boolean;
  shiftHeld: boolean;
  spaceHeld: boolean;
  dialog: DialogName;
  printImage: string | null;
  fitRequest: number;
  setActiveTab: (tab: PanelTab) => void;
  setViewport: (viewport: Viewport) => void;
  setStageSize: (size: { width: number; height: number }) => void;
  setCursorM: (cursor: { x: number; y: number } | null) => void;
  setHoverTableId: (id: string | null) => void;
  setDropTarget: (target: DropTarget | null) => void;
  setDraggingGuestId: (id: string | null) => void;
  setDragDelta: (delta: { id: string; dx: number; dy: number } | null) => void;
  setDragInfo: (info: UiState['dragInfo']) => void;
  setSelectionRect: (rect: UiState['selectionRect']) => void;
  requestFocus: (ref: ElementRef, seatIndex?: number | null) => void;
  flashTable: (id: string | null) => void;
  setCanvasSearch: (query: string) => void;
  setEventMode: (on: boolean) => void;
  setShiftHeld: (held: boolean) => void;
  setSpaceHeld: (held: boolean) => void;
  openDialog: (dialog: DialogName) => void;
  setPrintImage: (image: string | null) => void;
  requestFit: () => void;
};

export const useUiStore = create<UiState>((set, get) => ({
  activeTab: 'guests',
  viewport: { zoom: 1, x: 40, y: 40 },
  stageSize: { width: 0, height: 0 },
  cursorM: null,
  hoverTableId: null,
  dropTarget: null,
  draggingGuestId: null,
  dragDelta: null,
  dragInfo: null,
  selectionRect: null,
  focusRequest: null,
  flashTableId: null,
  canvasSearch: '',
  eventMode: false,
  shiftHeld: false,
  spaceHeld: false,
  dialog: null,
  printImage: null,
  fitRequest: 0,
  setActiveTab: (activeTab) => set({ activeTab }),
  setViewport: (viewport) => set({ viewport }),
  setStageSize: (stageSize) => {
    const current = get().stageSize;
    if (current.width !== stageSize.width || current.height !== stageSize.height) set({ stageSize });
  },
  setCursorM: (cursorM) => set({ cursorM }),
  setHoverTableId: (hoverTableId) => {
    if (get().hoverTableId !== hoverTableId) set({ hoverTableId });
  },
  setDropTarget: (dropTarget) => {
    const current = get().dropTarget;
    if (
      (current === null && dropTarget === null) ||
      (current && dropTarget && current.tableId === dropTarget.tableId && current.seatIndex === dropTarget.seatIndex && current.refused === dropTarget.refused)
    ) {
      return;
    }
    set({ dropTarget });
  },
  setDraggingGuestId: (draggingGuestId) => set({ draggingGuestId }),
  setDragDelta: (dragDelta) => set({ dragDelta }),
  setDragInfo: (dragInfo) => set({ dragInfo }),
  setSelectionRect: (selectionRect) => set({ selectionRect }),
  requestFocus: (ref, seatIndex = null) => set({ focusRequest: { ref, seatIndex, nonce: Date.now() } }),
  flashTable: (flashTableId) => set({ flashTableId }),
  setCanvasSearch: (canvasSearch) => set({ canvasSearch }),
  setEventMode: (eventMode) => set({ eventMode, dialog: null }),
  setShiftHeld: (shiftHeld) => {
    if (get().shiftHeld !== shiftHeld) set({ shiftHeld });
  },
  setSpaceHeld: (spaceHeld) => {
    if (get().spaceHeld !== spaceHeld) set({ spaceHeld });
  },
  openDialog: (dialog) => set({ dialog }),
  setPrintImage: (printImage) => set({ printImage }),
  requestFit: () => set({ fitRequest: get().fitRequest + 1 }),
}));
