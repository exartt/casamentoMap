import { SNAP_STEPS_M } from '@shared/config/defaults';
import { formatDecimal } from '@shared/domain/text';
import type { ProjectData } from '@shared/domain/types';
import { t } from '../../i18n/strings';
import { updateSettings } from '../../store/actions';
import { NumberField } from '../common/NumberField';
import { btn, checkbox, cx, label, select } from '../common/ui';
import { Modal } from './Modal';

type Props = { project: ProjectData; onClose: () => void };

/** Project settings: grid, snapping, aisle, door clearance and overlap prevention. */
export function SettingsDialog({ project, onClose }: Props) {
  const s = project.settings;
  return (
    <Modal
      title={t.settings.title}
      open
      onClose={onClose}
      size="sm"
      footer={
        <button type="button" className={cx(btn.base, btn.primary)} onClick={onClose}>
          {t.app.close}
        </button>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className={checkbox} checked={s.showGrid} onChange={(e) => updateSettings({ showGrid: e.target.checked })} />
          {t.settings.showGrid}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className={checkbox} checked={s.snapEnabled} onChange={(e) => updateSettings({ snapEnabled: e.target.checked })} />
          {t.settings.snapEnabled}
        </label>
        <div>
          <label className={label}>{t.settings.snapStep}</label>
          <select className={select} value={s.snapStepM} onChange={(e) => updateSettings({ snapStepM: Number(e.target.value) })}>
            {SNAP_STEPS_M.map((step) => (
              <option key={step} value={step}>
                {formatDecimal(step)} m
              </option>
            ))}
          </select>
        </div>
        <NumberField label={t.settings.minAisle} value={s.minAisleM} min={0} max={10} step={0.1} suffix="m" onChange={(v) => updateSettings({ minAisleM: v })} />
        <NumberField label={t.settings.doorClearance} value={s.doorClearanceM} min={0} max={10} step={0.1} suffix="m" onChange={(v) => updateSettings({ doorClearanceM: v })} />
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className={cx(checkbox, 'mt-0.5')} checked={s.preventOverlap} onChange={(e) => updateSettings({ preventOverlap: e.target.checked })} />
          <span>
            {t.settings.preventOverlap}
            <span className="block text-xs text-gray-500">{t.settings.preventOverlapHint}</span>
          </span>
        </label>
      </div>
    </Modal>
  );
}
