import type Konva from 'konva';

let current: Konva.Stage | null = null;

/** Registers the editor stage so export and print can reach it. */
export function setRegisteredStage(stage: Konva.Stage | null): void {
  current = stage;
}

/** Returns the registered editor stage, if mounted. */
export function getRegisteredStage(): Konva.Stage | null {
  return current;
}
