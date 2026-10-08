import { formatWhen } from '../../i18n/format';
import { t } from '../../i18n/strings';
import type { Draft } from '../../persistence/draft';
import { btn, cx } from '../common/ui';
import { Modal } from './Modal';

type Props = { draft: Draft; serverVersion: number; onRecover: () => void; onDiscard: () => void };

/** Offers to recover a local draft that differs from the server version. */
export function DraftDialog({ draft, serverVersion, onRecover, onDiscard }: Props) {
  return (
    <Modal
      title={t.draft.title}
      open
      onClose={onDiscard}
      size="sm"
      closeOnBackdrop={false}
      footer={
        <>
          <button type="button" className={cx(btn.base, btn.secondary)} onClick={onDiscard}>
            {t.draft.discard}
          </button>
          <button type="button" className={cx(btn.base, btn.primary)} onClick={onRecover}>
            {t.draft.recover}
          </button>
        </>
      }
    >
      <p>{t.draft.body(formatWhen(draft.savedAt), draft.baseVersion, serverVersion)}</p>
    </Modal>
  );
}
