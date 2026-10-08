import type Konva from 'konva';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Layer, Stage } from 'react-konva';
import { PX_PER_M, UNDER_TABLE_FIXTURES } from '@shared/config/defaults';
import {
  clampDoorOffset,
  distancesToWalls,
  doorCenter,
  fixtureShape,
  nearestWallPlacement,
  shapeBounds,
  tableShape,
  wallRotation,
  type Point,
} from '@shared/domain/geometry';
import { tableOccupancy } from '@shared/domain/seating';
import type { ElementRef, Guest, ProjectData, Table } from '@shared/domain/types';
import { addDoor, addFixture, addTable, commitDoorPlacement, commitPositions, seatGuest, updateFixture, updateTable, type PositionUpdate } from '../../store/actions';
import { colorForGroup, getDerived, searchSeatedGuests } from '../../store/derived';
import { useProjectStore } from '../../store/projectStore';
import { useUiStore, type Viewport } from '../../store/uiStore';
import { centerViewportOn, fitViewport, focusZoom, hitTestDrop, round2, screenToWorld, snapPosition, touchDistance, zoomAround } from './canvasUtils';
import { DoorClearance, DoorNode } from './DoorNode';
import { DragOverlay } from './DragOverlay';
import { FixtureNode } from './FixtureNode';
import { GridLayer } from './GridLayer';
import { GUEST_DRAG_TYPE, PALETTE_DRAG_TYPE, type PaletteItem } from './PaletteTypes';
import { SelectionTransformer } from './SelectionTransformer';
import { setRegisteredStage } from './stageRegistry';
import { TableNode, type DragHandlers, type SeatColors } from './TableNode';
import { TableTooltip } from './TableTooltip';

type Props = {
  project: ProjectData;
  readOnly?: boolean;
  externalHighlight?: { tableId: string; seatIndex: number | null } | null;
  onTableTap?: (id: string) => void;
  highlightQuery?: string;
  minimal?: boolean;
  focusAnchor?: { x: number; y: number };
};

const ZOOM_FACTOR = 1.08;

const SELECTION_THRESHOLD_M = 0.1;

const HIGHLIGHT_MS = 2500;

const MINOR_GRID_MIN_ZOOM = 1.2;

const ORIENTATION_REFIT_MS = 250;

const seatColorsCache = new WeakMap<Table, { guests: Guest[]; colors: SeatColors }>();

function seatColorsFor(table: Table, project: ProjectData): SeatColors {
  const cached = seatColorsCache.get(table);
  if (cached && cached.guests === project.guests) return cached.colors;
  const derived = getDerived(project);
  const colors: SeatColors = {};
  for (const seat of table.seats) {
    if (!seat.guestId) continue;
    const guest = derived.guestsById.get(seat.guestId);
    colors[seat.index] = colorForGroup(derived, guest?.group);
  }
  seatColorsCache.set(table, { guests: project.guests, colors });
  return colors;
}

/** The floor-plan canvas: venue, grid, fixtures, tables and doors, with zoom, pan, selection and drops. */
export function CanvasStage({ project, readOnly = false, externalHighlight = null, onTableTap, highlightQuery, minimal = false, focusAnchor }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const nodeRefs = useRef(new Map<string, Konva.Group>());
  const dragStart = useRef<Map<string, Point>>(new Map());
  const draggingId = useRef<string | null>(null);
  const doorDrag = useRef<{ wall: Table['seats'][number]['side']; offsetM: number } | null>(null);
  const panRef = useRef<{ startX: number; startY: number; viewport: Viewport } | null>(null);
  const selectStart = useRef<Point | null>(null);
  const fitted = useRef(false);
  const userAdjusted = useRef(false);
  const pinch = useRef<{ distance: number; center: Point } | null>(null);
  const [seatHighlight, setSeatHighlight] = useState<{ tableId: string; seatIndex: number | null } | null>(null);

  const viewport = useUiStore((s) => s.viewport);
  const setViewport = useUiStore((s) => s.setViewport);
  const stageSize = useUiStore((s) => s.stageSize);
  const setStageSize = useUiStore((s) => s.setStageSize);
  const spaceHeld = useUiStore((s) => s.spaceHeld);
  const dropTarget = useUiStore((s) => s.dropTarget);
  const dragDelta = useUiStore((s) => s.dragDelta);
  const flashTableId = useUiStore((s) => s.flashTableId);
  const focusRequest = useUiStore((s) => s.focusRequest);
  const fitRequest = useUiStore((s) => s.fitRequest);
  const canvasSearch = useUiStore((s) => s.canvasSearch);
  const selection = useProjectStore((s) => s.selection);
  const setSelection = useProjectStore((s) => s.setSelection);
  const toggleSelection = useProjectStore((s) => s.toggleSelection);

  const derived = getDerived(project);
  const interactive = !readOnly && !spaceHeld;

  const latest = useRef({ project, selection, viewport, stageSize, readOnly, focusAnchor });
  latest.current = { project, selection, viewport, stageSize, readOnly, focusAnchor };

  useEffect(() => {
    if (readOnly) return;
    setRegisteredStage(stageRef.current);
    return () => setRegisteredStage(null);
  }, [readOnly]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setStageSize({ width: Math.max(1, Math.floor(rect.width)), height: Math.max(1, Math.floor(rect.height)) });
    });
    observer.observe(el);
    setStageSize({ width: Math.max(1, el.clientWidth), height: Math.max(1, el.clientHeight) });
    return () => observer.disconnect();
  }, [setStageSize]);

  useEffect(() => {
    if (stageSize.width < 10 || stageSize.height < 10) return;
    if (fitted.current && (!readOnly || userAdjusted.current)) return;
    fitted.current = true;
    setViewport(fitViewport(project.venue, stageSize));
  }, [stageSize, project.venue, setViewport, readOnly]);

  useEffect(() => {
    if (fitRequest === 0) return;
    userAdjusted.current = false;
    setViewport(fitViewport(latest.current.project.venue, latest.current.stageSize));
  }, [fitRequest, setViewport]);

  useEffect(() => {
    if (!readOnly) return;
    const onOrientation = () => {
      userAdjusted.current = false;
      setTimeout(() => setViewport(fitViewport(latest.current.project.venue, latest.current.stageSize)), ORIENTATION_REFIT_MS);
    };
    window.addEventListener('orientationchange', onOrientation);
    return () => window.removeEventListener('orientationchange', onOrientation);
  }, [readOnly, setViewport]);

  useEffect(() => {
    if (!focusRequest) return;
    const { ref, seatIndex } = focusRequest;
    const p = latest.current.project;
    let point: Point | null = null;
    if (ref.type === 'table') {
      const table = p.tables.find((x) => x.id === ref.id);
      if (table) point = { x: table.x, y: table.y };
    } else if (ref.type === 'fixture') {
      const fixture = p.fixtures.find((x) => x.id === ref.id);
      if (fixture) point = { x: fixture.x, y: fixture.y };
    } else {
      const door = p.doors.find((x) => x.id === ref.id);
      if (door) point = doorCenter(door, p.venue);
    }
    if (!point) return;
    const current = latest.current;
    if (current.readOnly) {
      const fitZoom = fitViewport(current.project.venue, current.stageSize).zoom;
      const zoom = focusZoom(current.stageSize, Math.max(fitZoom, current.viewport.zoom));
      userAdjusted.current = true;
      setViewport(centerViewportOn(point, { ...current.viewport, zoom }, current.stageSize, current.focusAnchor));
    } else {
      setViewport(centerViewportOn(point, current.viewport, current.stageSize));
    }
    if (!latest.current.readOnly) setSelection([ref.id]);
    if (ref.type === 'table') {
      setSeatHighlight({ tableId: ref.id, seatIndex });
      const timer = setTimeout(() => setSeatHighlight(null), HIGHLIGHT_MS);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [focusRequest, setViewport, setSelection]);

  const registerNode = useCallback((id: string, node: Konva.Group | null) => {
    if (node) nodeRefs.current.set(id, node);
    else nodeRefs.current.delete(id);
  }, []);

  const onSelect = useCallback(
    (id: string, e: Konva.KonvaEventObject<Event>) => {
      e.cancelBubble = true;
      if (latest.current.readOnly) {
        onTableTap?.(id);
        return;
      }
      const shift = 'shiftKey' in e.evt && e.evt.shiftKey;
      if (shift) toggleSelection(id);
      else setSelection([id]);
    },
    [onTableTap, setSelection, toggleSelection],
  );

  const onSeatClick = useCallback(
    (tableId: string, seatIndex: number, e: Konva.KonvaEventObject<Event>) => {
      e.cancelBubble = true;
      if (latest.current.readOnly) {
        onTableTap?.(tableId);
        return;
      }
      const shift = 'shiftKey' in e.evt && e.evt.shiftKey;
      if (shift) {
        toggleSelection(tableId);
        return;
      }
      setSelection([tableId]);
      useUiStore.getState().setActiveTab('properties');
      useUiStore.getState().requestFocus({ type: 'table', id: tableId }, seatIndex);
    },
    [onTableTap, setSelection, toggleSelection],
  );

  const onHover = useCallback((id: string | null) => {
    useUiStore.getState().setHoverTableId(id);
  }, []);

  const movableSelection = useCallback((): string[] => {
    const p = latest.current.project;
    const d = getDerived(p);
    return latest.current.selection.filter((id) => {
      const table = d.tablesById.get(id);
      if (table) return !table.locked;
      const fixture = d.fixturesById.get(id);
      return fixture ? !fixture.locked : false;
    });
  }, []);

  const drag = useMemo<DragHandlers>(
    () => ({
      onDragStart: (e) => {
        const node = e.target as Konva.Group;
        const id = node.id();
        let sel = latest.current.selection;
        if (!sel.includes(id)) {
          sel = [id];
          setSelection(sel);
          latest.current.selection = sel;
        }
        const p = latest.current.project;
        const d = getDerived(p);
        dragStart.current = new Map();
        for (const sid of movableSelection()) {
          const el = d.tablesById.get(sid) ?? d.fixturesById.get(sid);
          if (el) dragStart.current.set(sid, { x: el.x, y: el.y });
        }
        if (!dragStart.current.has(id)) dragStart.current.set(id, { x: node.x(), y: node.y() });
        draggingId.current = id;
        useUiStore.getState().setHoverTableId(null);
      },
      onDragMove: (e) => {
        const node = e.target as Konva.Group;
        const id = node.id();
        const p = latest.current.project;
        const snapped = snapPosition(node.position(), p.settings);
        node.position(snapped);
        const start = dragStart.current.get(id);
        if (!start) return;
        const dx = round2(snapped.x - start.x);
        const dy = round2(snapped.y - start.y);
        const ui = useUiStore.getState();
        if (dragStart.current.size > 1) ui.setDragDelta({ id, dx, dy });
        const d = getDerived(p);
        const table = d.tablesById.get(id);
        const fixture = d.fixturesById.get(id);
        const shape = table ? tableShape({ ...table, x: snapped.x, y: snapped.y }) : fixture ? fixtureShape({ ...fixture, x: snapped.x, y: snapped.y }) : null;
        if (!shape) return;
        const bounds = shapeBounds(shape);
        const dist = distancesToWalls(shape, p.venue);
        ui.setDragInfo({ ref: table ? { type: 'table', id } : { type: 'fixture', id }, bounds, ...dist });
      },
      onDragEnd: (e) => {
        const node = e.target as Konva.Group;
        const id = node.id();
        const start = dragStart.current.get(id);
        const ui = useUiStore.getState();
        ui.setDragDelta(null);
        ui.setDragInfo(null);
        draggingId.current = null;
        if (!start) return;
        const dx = round2(node.x() - start.x);
        const dy = round2(node.y() - start.y);
        const updates: PositionUpdate[] = [];
        for (const [sid, s] of dragStart.current) {
          updates.push(sid === id ? { id: sid, x: round2(node.x()), y: round2(node.y()) } : { id: sid, x: round2(s.x + dx), y: round2(s.y + dy) });
        }
        const { reverted } = commitPositions(updates);
        for (const rid of reverted) {
          const s = dragStart.current.get(rid);
          const n = nodeRefs.current.get(rid);
          if (s && n) n.position(s);
        }
        dragStart.current = new Map();
      },
    }),
    [movableSelection, setSelection],
  );

  const doorDragHandlers = useMemo(
    () => ({
      onDragStart: (e: Konva.KonvaEventObject<DragEvent>) => {
        const id = (e.target as Konva.Group).id();
        setSelection([id]);
        doorDrag.current = null;
      },
      onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => {
        const node = e.target as Konva.Group;
        const stage = node.getStage();
        if (!stage) return;
        const pointer = stage.getRelativePointerPosition();
        if (!pointer) return;
        const p = latest.current.project;
        const door = p.doors.find((d) => d.id === node.id());
        if (!door) return;
        const placement = nearestWallPlacement(pointer, p.venue);
        const offsetM = round2(clampDoorOffset({ wall: placement.wall, widthM: door.widthM }, placement.offsetM, p.venue));
        const snapped = p.settings.snapEnabled ? round2(clampDoorOffset({ wall: placement.wall, widthM: door.widthM }, snapPosition({ x: offsetM, y: 0 }, p.settings).x, p.venue)) : offsetM;
        const center = doorCenter({ wall: placement.wall, offsetM: snapped }, p.venue);
        node.position(center);
        node.rotation(wallRotation(placement.wall));
        doorDrag.current = { wall: placement.wall, offsetM: snapped };
      },
      onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
        const node = e.target as Konva.Group;
        const placement = doorDrag.current;
        doorDrag.current = null;
        if (!placement) return;
        commitDoorPlacement(node.id(), placement.wall, placement.offsetM);
      },
    }),
    [setSelection],
  );

  const onTransformEnd = useCallback((ref: ElementRef, node: Konva.Group) => {
    if (ref.type === 'table') {
      updateTable(ref.id, { x: round2(node.x()), y: round2(node.y()), rotation: Math.round(node.rotation()) });
      return;
    }
    if (ref.type === 'fixture') {
      const fixture = latest.current.project.fixtures.find((f) => f.id === ref.id);
      if (!fixture) return;
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      node.scale({ x: 1, y: 1 });
      const widthM = round2(Math.max(0.3, fixture.widthM * scaleX));
      const depthM = fixture.shape === 'circle' ? widthM : round2(Math.max(0.3, fixture.depthM * scaleY));
      updateFixture(ref.id, { x: round2(node.x()), y: round2(node.y()), rotation: Math.round(node.rotation()), widthM, depthM });
    }
  }, []);

  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const vp = latest.current.viewport;
      userAdjusted.current = true;
      const direction = e.evt.deltaY > 0 ? -1 : 1;
      const next = direction > 0 ? vp.zoom * ZOOM_FACTOR : vp.zoom / ZOOM_FACTOR;
      setViewport(zoomAround(vp, pointer, next));
    },
    [setViewport],
  );

  const handleMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const stage = stageRef.current;
      if (!stage) return;
      if (e.evt.button === 1) {
        e.evt.preventDefault();
        panRef.current = { startX: e.evt.clientX, startY: e.evt.clientY, viewport: latest.current.viewport };
        return;
      }
      if (e.evt.button !== 0 || latest.current.readOnly || useUiStore.getState().spaceHeld) return;
      if (e.target !== stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const world = screenToWorld(pointer, latest.current.viewport);
      selectStart.current = world;
      useUiStore.getState().setSelectionRect({ x1: world.x, y1: world.y, x2: world.x, y2: world.y });
    },
    [],
  );

  const handleMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const stage = stageRef.current;
      if (!stage) return;
      if (panRef.current) {
        const { startX, startY, viewport: vp } = panRef.current;
        setViewport({ zoom: vp.zoom, x: vp.x + (e.evt.clientX - startX), y: vp.y + (e.evt.clientY - startY) });
        return;
      }
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const world = screenToWorld(pointer, latest.current.viewport);
      const ui = useUiStore.getState();
      ui.setCursorM({ x: round2(world.x), y: round2(world.y) });
      if (selectStart.current) {
        ui.setSelectionRect({ x1: selectStart.current.x, y1: selectStart.current.y, x2: world.x, y2: world.y });
      }
    },
    [setViewport],
  );

  const finishSelection = useCallback(
    (shift: boolean) => {
      const start = selectStart.current;
      const rect = useUiStore.getState().selectionRect;
      selectStart.current = null;
      useUiStore.getState().setSelectionRect(null);
      if (!start || !rect) return;
      const width = Math.abs(rect.x2 - rect.x1);
      const height = Math.abs(rect.y2 - rect.y1);
      if (width < SELECTION_THRESHOLD_M && height < SELECTION_THRESHOLD_M) {
        if (!shift) setSelection([]);
        return;
      }
      const minX = Math.min(rect.x1, rect.x2);
      const maxX = Math.max(rect.x1, rect.x2);
      const minY = Math.min(rect.y1, rect.y2);
      const maxY = Math.max(rect.y1, rect.y2);
      const p = latest.current.project;
      const inside = (x: number, y: number) => x >= minX && x <= maxX && y >= minY && y <= maxY;
      const ids = [
        ...p.tables.filter((t) => inside(t.x, t.y)).map((t) => t.id),
        ...p.fixtures.filter((f) => inside(f.x, f.y)).map((f) => f.id),
      ];
      setSelection(shift ? [...new Set([...latest.current.selection, ...ids])] : ids);
    },
    [setSelection],
  );

  const handleMouseUp = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (panRef.current) {
        panRef.current = null;
        return;
      }
      if (selectStart.current) finishSelection(e.evt.shiftKey);
    },
    [finishSelection],
  );

  const handleMouseLeave = useCallback(() => {
    panRef.current = null;
    useUiStore.getState().setCursorM(null);
    if (selectStart.current) finishSelection(false);
  }, [finishSelection]);

  const handleStageDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const stage = stageRef.current;
      if (!stage || e.target !== stage) return;
      userAdjusted.current = true;
      setViewport({ zoom: latest.current.viewport.zoom, x: stage.x(), y: stage.y() });
    },
    [setViewport],
  );

  const handleTouchMove = useCallback(
    (e: Konva.KonvaEventObject<TouchEvent>) => {
      const touches = e.evt.touches;
      if (touches.length !== 2) return;
      e.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;
      if (stage.isDragging()) stage.stopDrag();
      const rect = stage.container().getBoundingClientRect();
      const p1 = { x: touches[0].clientX - rect.left, y: touches[0].clientY - rect.top };
      const p2 = { x: touches[1].clientX - rect.left, y: touches[1].clientY - rect.top };
      const center = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      const distance = touchDistance(p1, p2);
      const previous = pinch.current;
      pinch.current = { distance, center };
      if (!previous || previous.distance === 0) return;
      const vp = latest.current.viewport;
      const zoomed = zoomAround(vp, previous.center, vp.zoom * (distance / previous.distance));
      userAdjusted.current = true;
      setViewport({ zoom: zoomed.zoom, x: zoomed.x + (center.x - previous.center.x), y: zoomed.y + (center.y - previous.center.y) });
    },
    [setViewport],
  );

  const handleTouchEnd = useCallback(() => {
    pinch.current = null;
  }, []);

  const worldFromDomEvent = useCallback((e: React.DragEvent): Point | null => {
    const stage = stageRef.current;
    if (!stage) return null;
    stage.setPointersPositions(e.nativeEvent);
    return stage.getRelativePointerPosition();
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (latest.current.readOnly) return;
      const types = Array.from(e.dataTransfer.types);
      const isGuest = types.includes(GUEST_DRAG_TYPE);
      const isPalette = types.includes(PALETTE_DRAG_TYPE);
      if (!isGuest && !isPalette) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = isGuest ? 'move' : 'copy';
      if (!isGuest) return;
      const world = worldFromDomEvent(e);
      const ui = useUiStore.getState();
      if (!world) {
        ui.setDropTarget(null);
        return;
      }
      const hit = hitTestDrop(latest.current.project, world);
      if (!hit) {
        ui.setDropTarget(null);
        return;
      }
      const table = getDerived(latest.current.project).tablesById.get(hit.tableId);
      if (!table) {
        ui.setDropTarget(null);
        return;
      }
      let refused = false;
      if (hit.seatIndex === null) refused = tableOccupancy(table).free === 0 && !table.seats.some((s) => s.guestId === ui.draggingGuestId);
      else refused = !table.seats[hit.seatIndex].enabled;
      ui.setDropTarget({ tableId: hit.tableId, seatIndex: hit.seatIndex, refused });
    },
    [worldFromDomEvent],
  );

  const handleDragLeave = useCallback(() => {
    useUiStore.getState().setDropTarget(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      if (latest.current.readOnly) return;
      e.preventDefault();
      const ui = useUiStore.getState();
      ui.setDropTarget(null);
      const world = worldFromDomEvent(e);
      if (!world) return;
      const guestId = e.dataTransfer.getData(GUEST_DRAG_TYPE) || ui.draggingGuestId;
      if (guestId) {
        ui.setDraggingGuestId(null);
        const hit = hitTestDrop(latest.current.project, world);
        if (!hit) return;
        void seatGuest(guestId, hit.tableId, hit.seatIndex);
        return;
      }
      const raw = e.dataTransfer.getData(PALETTE_DRAG_TYPE);
      if (!raw) return;
      let item: PaletteItem;
      try {
        item = JSON.parse(raw) as PaletteItem;
      } catch {
        return;
      }
      if (item.type === 'table') addTable(item.kind, world, item.couple);
      else if (item.type === 'fixture') addFixture(item.kind, world);
      else {
        const placement = nearestWallPlacement(world, latest.current.project.venue);
        addDoor(item.kind, placement);
      }
      ui.setActiveTab('properties');
    },
    [worldFromDomEvent],
  );

  const selectedRef: ElementRef | null = useMemo(() => {
    if (readOnly || selection.length !== 1) return null;
    const id = selection[0];
    if (derived.tablesById.has(id)) return { type: 'table', id };
    if (derived.fixturesById.has(id)) return { type: 'fixture', id };
    if (derived.doorsById.has(id)) return { type: 'door', id };
    return null;
  }, [selection, derived, readOnly]);

  const selectedNode = selectedRef ? nodeRefs.current.get(selectedRef.id) ?? null : null;
  const selectedFixture = selectedRef?.type === 'fixture' ? derived.fixturesById.get(selectedRef.id) : undefined;
  const selectedSet = useMemo(() => new Set(selection), [selection]);
  const effectiveQuery = highlightQuery !== undefined ? highlightQuery : readOnly ? '' : canvasSearch;
  const search = useMemo(() => searchSeatedGuests(project, effectiveQuery), [project, effectiveQuery]);
  const underFixtures = project.fixtures.filter((f) => UNDER_TABLE_FIXTURES.includes(f.kind));
  const overFixtures = project.fixtures.filter((f) => !UNDER_TABLE_FIXTURES.includes(f.kind));
  const highlight = externalHighlight ?? seatHighlight;
  const scale = viewport.zoom * PX_PER_M;

  const renderFixture = (fixture: ProjectData['fixtures'][number]) => (
    <FixtureNode
      key={fixture.id}
      fixture={fixture}
      selected={selectedSet.has(fixture.id)}
      warningLevel={minimal ? 'none' : derived.warningLevels.get(fixture.id) ?? 'none'}
      interactive={interactive}
      dragOffset={dragDelta && dragDelta.id !== fixture.id && selectedSet.has(fixture.id) && !fixture.locked ? { dx: dragDelta.dx, dy: dragDelta.dy } : null}
      registerNode={registerNode}
      onSelect={onSelect}
      drag={drag}
    />
  );

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full touch-none overflow-hidden bg-gray-200"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      data-testid="canvas"
    >
      <Stage
        ref={stageRef}
        width={Math.max(1, stageSize.width)}
        height={Math.max(1, stageSize.height)}
        scaleX={scale}
        scaleY={scale}
        x={viewport.x}
        y={viewport.y}
        draggable={spaceHeld || readOnly}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onDragEnd={handleStageDragEnd}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onContextMenu={(e) => e.evt.preventDefault()}
        style={{ cursor: spaceHeld ? 'grab' : 'default' }}
      >
        <Layer listening={false}>
          <GridLayer venue={project.venue} showGrid={project.settings.showGrid} showMinor={viewport.zoom >= MINOR_GRID_MIN_ZOOM} />
          {!minimal &&
            project.doors.map((door) => (
              <DoorClearance key={door.id} door={door} venue={project.venue} clearanceM={project.settings.doorClearanceM} />
            ))}
        </Layer>
        <Layer>
          {underFixtures.map(renderFixture)}
          {overFixtures.map(renderFixture)}
          {project.tables.map((table) => (
            <TableNode
              key={table.id}
              table={table}
              selected={selectedSet.has(table.id)}
              warningLevel={minimal ? 'none' : derived.warningLevels.get(table.id) ?? 'none'}
              seatColors={seatColorsFor(table, project)}
              dropSeatIndex={dropTarget && dropTarget.tableId === table.id ? dropTarget.seatIndex : null}
              dropTable={dropTarget !== null && dropTarget.tableId === table.id}
              dropRefused={dropTarget !== null && dropTarget.tableId === table.id && dropTarget.refused}
              flash={flashTableId === table.id}
              searchState={search === null ? 'none' : search.tableIds.has(table.id) ? 'match' : 'dim'}
              matchedSeats={search === null ? null : search.seatsByTable.get(table.id) ?? null}
              highlightSeat={highlight && highlight.tableId === table.id ? highlight.seatIndex : null}
              interactive={interactive}
              dragOffset={dragDelta && dragDelta.id !== table.id && selectedSet.has(table.id) && !table.locked ? { dx: dragDelta.dx, dy: dragDelta.dy } : null}
              registerNode={registerNode}
              onSelect={onSelect}
              onSeatClick={onSeatClick}
              onHover={onHover}
              drag={drag}
            />
          ))}
          {project.doors.map((door) => (
            <DoorNode
              key={door.id}
              door={door}
              venue={project.venue}
              selected={selectedSet.has(door.id)}
              interactive={interactive}
              registerNode={registerNode}
              onSelect={onSelect}
              onDragStart={doorDragHandlers.onDragStart}
              onDragMove={doorDragHandlers.onDragMove}
              onDragEnd={doorDragHandlers.onDragEnd}
            />
          ))}
        </Layer>
        <Layer>
          <DragOverlay venue={project.venue} />
          {!readOnly && (
            <SelectionTransformer selected={selectedRef} node={selectedNode} keepRatio={selectedFixture?.shape === 'circle'} onRotateEnd={onTransformEnd} />
          )}
        </Layer>
      </Stage>
      {!readOnly && <TableTooltip project={project} />}
    </div>
  );
}

