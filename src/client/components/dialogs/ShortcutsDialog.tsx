import { t } from '../../i18n/strings';
import { btn, cx } from '../common/ui';
import { Modal } from './Modal';

type Props = { onClose: () => void };

/** Lists the keyboard shortcuts. */
export function ShortcutsDialog({ onClose }: Props) {
  return (
    <Modal
      title={t.shortcuts.title}
      open
      onClose={onClose}
      size="sm"
      footer={
        <button type="button" className={cx(btn.base, btn.primary)} onClick={onClose}>
          {t.app.close}
        </button>
      }
    >
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        {t.shortcuts.list.map(([key, desc]) => (
          <div key={key} className="contents">
            <dt className="font-mono text-xs text-gray-700">{key}</dt>
            <dd>{desc}</dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}
