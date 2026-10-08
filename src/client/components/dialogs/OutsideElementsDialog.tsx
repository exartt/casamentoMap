import type { ElementRef, ProjectData } from '@shared/domain/types';
import { t } from '../../i18n/strings';
import { bringInsideVenue } from '../../store/actions';
import { getDerived } from '../../store/derived';
import { btn, cx } from '../common/ui';
import { Modal } from './Modal';

type Props = { refs: ElementRef[]; project: ProjectData; onClose: () => void };

/** Lists elements left outside after the venue shrank and offers to bring them inside. */
export function OutsideElementsDialog({ refs, project, onClose }: Props) {
  const derived = getDerived(project);
  const names = refs.map((r) => (r.type === 'table' ? derived.tablesById.get(r.id)?.label : derived.fixturesById.get(r.id)?.label) ?? r.id);
  return (
    <Modal
      title={t.venue.outsideTitle}
      open
      onClose={onClose}
      size="sm"
      footer={
        <>
          <button type="button" className={cx(btn.base, btn.secondary)} onClick={onClose}>
            {t.venue.leave}
          </button>
          <button
            type="button"
            className={cx(btn.base, btn.primary)}
            onClick={() => {
              bringInsideVenue(refs);
              onClose();
            }}
          >
            {t.venue.bringInside}
          </button>
        </>
      }
    >
      <p>{t.venue.outsideIntro}</p>
      <ul className="mt-2 list-disc pl-5">
        {names.map((name, i) => (
          <li key={i}>{name}</li>
        ))}
      </ul>
    </Modal>
  );
}
