import { useCallback, useEffect, useState } from 'react';
import { ShareLinksDialog } from '../components/admin/ShareLinksDialog';
import { UsersDialog } from '../components/admin/UsersDialog';
import { CanvasSearch } from '../components/canvas/CanvasSearch';
import { CanvasStage } from '../components/canvas/CanvasStage';
import { EventDayView } from '../components/event/EventDayView';
import { Toasts } from '../components/common/Toasts';
import { btn, cx } from '../components/common/ui';
import { ChangePasswordDialog } from '../components/dialogs/ChangePasswordDialog';
import { ConfirmDialog } from '../components/dialogs/ConfirmDialog';
import { ConflictDialog } from '../components/dialogs/ConflictDialog';
import { DraftDialog } from '../components/dialogs/DraftDialog';
import { ImportGuestsDialog } from '../components/dialogs/ImportGuestsDialog';
import { ImportProjectDialog } from '../components/dialogs/ImportProjectDialog';
import { SettingsDialog } from '../components/dialogs/SettingsDialog';
import { TableListDialog } from '../components/dialogs/TableListDialog';
import { ShortcutsDialog } from '../components/dialogs/ShortcutsDialog';
import { SidePanel } from '../components/panels/SidePanel';
import { PrintView } from '../components/print/PrintView';
import { Palette } from '../components/toolbar/Palette';
import { StatusBar } from '../components/toolbar/StatusBar';
import { TopBar } from '../components/toolbar/TopBar';
import { renderPlanDataUrl } from '../export/exportPng';
import { t } from '../i18n/strings';
import { clearDraft, readDraft, scheduleDraft, shouldOfferDraft, type Draft } from '../persistence/draft';
import { selectIsDirty, useProjectStore } from '../store/projectStore';
import { toastSuccess } from '../store/toastStore';
import { useUiStore } from '../store/uiStore';
import { useEditorShortcuts } from './useEditorShortcuts';

const PRINT_PIXEL_RATIO = 2;

/** The main editor page: toolbar, palette, canvas, side panel, status bar and dialogs. */
export function Editor() {
  const project = useProjectStore((s) => s.project);
  const dirty = useProjectStore(selectIsDirty);
  const dialog = useUiStore((s) => s.dialog);
  const eventMode = useUiStore((s) => s.eventMode);
  const setEventMode = useUiStore((s) => s.setEventMode);
  const openDialog = useUiStore((s) => s.openDialog);
  const printImage = useUiStore((s) => s.printImage);
  const setPrintImage = useUiStore((s) => s.setPrintImage);
  const requestFit = useUiStore((s) => s.requestFit);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftChecked, setDraftChecked] = useState(false);

  useEditorShortcuts();

  useEffect(() => {
    if (draftChecked) return;
    const state = useProjectStore.getState();
    if (!state.savedProject) return;
    const stored = readDraft();
    if (shouldOfferDraft(stored, state.savedProject)) setDraft(stored);
    else clearDraft();
    setDraftChecked(true);
  }, [draftChecked]);

  useEffect(() => {
    if (!draftChecked || draft) return;
    return useProjectStore.subscribe((state, previous) => {
      if (state.project === previous.project) return;
      if (selectIsDirty(state) && state.project) scheduleDraft(state.project, state.baseVersion);
      else clearDraft();
    });
  }, [draftChecked, draft]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!selectIsDirty(useProjectStore.getState())) return;
      e.preventDefault();
      e.returnValue = t.beforeUnload;
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  useEffect(() => {
    const onAfterPrint = () => setPrintImage(null);
    window.addEventListener('afterprint', onAfterPrint);
    return () => window.removeEventListener('afterprint', onAfterPrint);
  }, [setPrintImage]);

  const onPrint = useCallback(() => {
    if (!project) return;
    const image = renderPlanDataUrl(project, PRINT_PIXEL_RATIO);
    setPrintImage(image);
    setTimeout(() => window.print(), 150);
  }, [project, setPrintImage]);

  const recoverDraft = () => {
    if (!draft) return;
    useProjectStore.getState().replaceProject(draft.data, { baseVersion: draft.baseVersion, editingCopyOfVersion: null });
    setDraft(null);
    toastSuccess(t.toasts.draftRecovered);
  };

  const discardDraft = () => {
    clearDraft();
    setDraft(null);
  };

  if (!project) return null;
  const closeDialog = () => openDialog(null);

  if (eventMode) {
    return (
      <>
        <EventDayView project={project} note={dirty ? t.eventMode.unsavedNote : undefined} onExit={() => setEventMode(false)} />
        <Toasts />
      </>
    );
  }

  return (
    <>
    <div className="editor flex h-screen flex-col bg-gray-100 print:hidden">
      <TopBar onPrint={onPrint} />
      <div className="flex min-h-0 flex-1">
        <Palette />
        <main className="relative min-w-0 flex-1">
          <CanvasStage project={project} />
          <CanvasSearch project={project} />
          <button
            type="button"
            className={cx(btn.base, btn.secondary, btn.small, 'absolute right-2 top-2 shadow')}
            onClick={requestFit}
            title={t.topbar.fitToScreen}
          >
            ⤢ {t.topbar.fitToScreen}
          </button>
        </main>
        <SidePanel project={project} />
      </div>
      <StatusBar />

      <ConflictDialog />
      <ConfirmDialog />
      <Toasts />
      {draft && <DraftDialog draft={draft} serverVersion={useProjectStore.getState().serverInfo?.version ?? 0} onRecover={recoverDraft} onDiscard={discardDraft} />}
      {dialog === 'settings' && <SettingsDialog project={project} onClose={closeDialog} />}
      {dialog === 'importGuests' && <ImportGuestsDialog onClose={closeDialog} />}
      {dialog === 'importProject' && <ImportProjectDialog onClose={closeDialog} />}
      {dialog === 'users' && <UsersDialog onClose={closeDialog} />}
      {dialog === 'shareLinks' && <ShareLinksDialog onClose={closeDialog} />}
      {dialog === 'changePassword' && <ChangePasswordDialog onClose={closeDialog} />}
      {dialog === 'shortcuts' && <ShortcutsDialog onClose={closeDialog} />}
      {dialog === 'tableList' && <TableListDialog project={project} onClose={closeDialog} />}
      {dirty && <span className="sr-only" aria-live="polite">{t.topbar.unsaved}</span>}
    </div>
    <PrintView project={project} planImage={printImage} />
    </>
  );
}
