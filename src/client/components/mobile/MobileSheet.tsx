import { useEffect } from 'react';
import type { ProjectData } from '@shared/domain/types';
import { t } from '../../i18n/strings';
import { useUiStore } from '../../store/uiStore';
import { SidePanel } from '../panels/SidePanel';
import { Palette } from '../toolbar/Palette';
import { btn, cx } from '../common/ui';

type Props = { project: ProjectData };

/** Panel drawer for phones (bottom sheet) and tablets (right drawer) showing the panel picked in the bottom nav. */
export function MobileSheet({ project }: Props) {
  const panel = useUiStore((s) => s.mobilePanel);
  const setMobilePanel = useUiStore((s) => s.setMobilePanel);

  useEffect(() => {
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobilePanel(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panel, setMobilePanel]);

  if (!panel) return null;
  return (
    <>
      <button type="button" className="absolute inset-0 z-20 bg-black/20 sm:bg-transparent" aria-label={t.mobile.close} onClick={() => setMobilePanel(null)} tabIndex={-1} />
      <section
        className={cx(
          'absolute inset-x-0 bottom-0 z-30 flex h-[75%] flex-col rounded-t-2xl bg-white shadow-2xl',
          'sm:inset-x-auto sm:bottom-0 sm:right-0 sm:top-0 sm:h-auto sm:w-[400px] sm:rounded-none sm:border-l sm:border-gray-200',
        )}
        aria-label={t.mobile.titles[panel]}
      >
        <span className="mx-auto mt-2 block h-1 w-10 shrink-0 rounded-full bg-gray-300 sm:hidden" aria-hidden="true" />
        <div className="flex items-center justify-between border-b border-gray-100 py-1 pl-4 pr-2">
          <h2 className="text-base font-semibold text-gray-900">{t.mobile.titles[panel]}</h2>
          <button type="button" className={cx(btn.base, btn.ghost, btn.icon, 'text-xl')} onClick={() => setMobilePanel(null)} aria-label={t.mobile.close}>
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {panel === 'palette' ? <Palette variant="sheet" /> : <SidePanel project={project} variant="sheet" />}
        </div>
      </section>
    </>
  );
}
