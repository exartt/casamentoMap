import { useEffect } from 'react';
import { KEYBOARD_MOVE_STEP_LARGE_M, KEYBOARD_MOVE_STEP_M, KEYBOARD_ROTATE_STEP_DEG } from '@shared/config/defaults';
import { performSave } from '../persistence/saveFlow';
import { deleteElements, duplicateElements, nudgeElements, rotateElements } from '../store/actions';
import { useProjectStore } from '../store/projectStore';
import { useUiStore } from '../store/uiStore';

function isTextTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.closest('[role="dialog"]') !== null;
}

/** Installs the editor keyboard shortcuts (Ctrl+S always works; the others ignore text fields). */
export function useEditorShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const ui = useUiStore.getState();
      if (ui.eventMode) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (e.key === 'Shift') ui.setShiftHeld(true);
      if (ctrl && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        void performSave();
        return;
      }
      if (isTextTarget(e.target)) return;
      if (e.code === 'Space') {
        if (!e.repeat) ui.setSpaceHeld(true);
        e.preventDefault();
        return;
      }
      const store = useProjectStore.getState();
      const selection = store.selection;
      if (ctrl && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) store.redo();
        else store.undo();
        return;
      }
      if (ctrl && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        store.redo();
        return;
      }
      if (ctrl && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        if (selection.length > 0) duplicateElements(selection);
        return;
      }
      if (e.key === 'Escape') {
        store.clearSelection();
        return;
      }
      if (selection.length === 0) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        void deleteElements(selection);
        return;
      }
      if (e.key === 'r' || e.key === 'R') {
        rotateElements(selection, KEYBOARD_ROTATE_STEP_DEG);
        return;
      }
      const step = e.shiftKey ? KEYBOARD_MOVE_STEP_LARGE_M : KEYBOARD_MOVE_STEP_M;
      if (e.key === 'ArrowLeft') nudgeElements(selection, -step, 0);
      else if (e.key === 'ArrowRight') nudgeElements(selection, step, 0);
      else if (e.key === 'ArrowUp') nudgeElements(selection, 0, -step);
      else if (e.key === 'ArrowDown') nudgeElements(selection, 0, step);
      else return;
      e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const ui = useUiStore.getState();
      if (e.key === 'Shift') ui.setShiftHeld(false);
      if (e.code === 'Space') ui.setSpaceHeld(false);
    };
    const onBlur = () => {
      const ui = useUiStore.getState();
      ui.setShiftHeld(false);
      ui.setSpaceHeld(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);
}
