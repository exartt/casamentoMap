import type { ProjectData } from '@shared/domain/types';
import { t } from '../../i18n/strings';
import { getDerived } from '../../store/derived';
import { useUiStore } from '../../store/uiStore';
import { btn, cx } from '../common/ui';

type Props = { project: ProjectData };

/** Banner shown while picking a table or seat for a guest on touch devices. */
export function SeatPickBanner({ project }: Props) {
  const guestId = useUiStore((s) => s.pendingSeatGuestId);
  const setPending = useUiStore((s) => s.setPendingSeatGuest);
  if (!guestId) return null;
  const guest = getDerived(project).guestsById.get(guestId);
  if (!guest) return null;
  return (
    <div className="absolute inset-x-2 top-2 z-20 flex items-center gap-3 rounded-lg bg-brand-700 px-3 py-2.5 text-sm text-white shadow-lg sm:left-1/2 sm:right-auto sm:w-[28rem] sm:-translate-x-1/2" role="status">
      <span className="flex-1">{t.mobile.seatHint(guest.name)}</span>
      <button type="button" className={cx(btn.base, 'bg-white/15 text-white hover:bg-white/25')} onClick={() => setPending(null)}>
        {t.mobile.cancelSeat}
      </button>
    </div>
  );
}
