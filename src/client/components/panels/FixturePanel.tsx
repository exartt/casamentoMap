import { FIXTURE_SPECS, LIMITS } from '@shared/config/defaults';
import type { Fixture } from '@shared/domain/types';
import { t } from '../../i18n/strings';
import { deleteElements, duplicateElements, updateFixture } from '../../store/actions';
import { NumberField } from '../common/NumberField';
import { btn, checkbox, cx, input, label } from '../common/ui';

type Props = { fixture: Fixture };

/** Properties of the selected fixture: name, size, rotation, position, color and flags. */
export function FixturePanel({ fixture }: Props) {
  const spec = FIXTURE_SPECS[fixture.kind];
  const circle = fixture.shape === 'circle';
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <label className={label}>{t.fixture.name}</label>
          <input className={input} value={fixture.label} maxLength={LIMITS.maxLabelLength} onChange={(e) => updateFixture(fixture.id, { label: e.target.value }, `label:${fixture.id}`)} />
        </div>
        <div className="col-span-2 text-xs text-gray-500">
          {t.fixture.kind}: {spec.labelPt}
        </div>
        {circle ? (
          <NumberField label={t.fixture.diameter} value={fixture.widthM} min={LIMITS.minElementM} max={LIMITS.maxElementM} step={0.1} suffix="m" onChange={(v) => updateFixture(fixture.id, { widthM: v, depthM: v })} />
        ) : (
          <>
            <NumberField label={t.fixture.width} value={fixture.widthM} min={LIMITS.minElementM} max={LIMITS.maxElementM} step={0.1} suffix="m" onChange={(v) => updateFixture(fixture.id, { widthM: v })} />
            <NumberField label={t.fixture.depth} value={fixture.depthM} min={LIMITS.minElementM} max={LIMITS.maxElementM} step={0.1} suffix="m" onChange={(v) => updateFixture(fixture.id, { depthM: v })} />
          </>
        )}
        <NumberField label={t.table.rotation} value={fixture.rotation} decimals={0} step={15} suffix="°" onChange={(v) => updateFixture(fixture.id, { rotation: v })} />
        {circle && <div />}
        <NumberField label={t.table.x} value={fixture.x} step={0.1} suffix="m" onChange={(v) => updateFixture(fixture.id, { x: v })} />
        <NumberField label={t.table.y} value={fixture.y} step={0.1} suffix="m" onChange={(v) => updateFixture(fixture.id, { y: v })} />
        <div className="col-span-2">
          <label className={label}>{t.fixture.color}</label>
          <div className="flex items-center gap-2">
            <input type="color" className="h-8 w-12 cursor-pointer rounded border border-gray-300" value={fixture.color} onChange={(e) => updateFixture(fixture.id, { color: e.target.value }, `color:${fixture.id}`)} aria-label={t.fixture.color} />
            <span className="text-xs text-gray-500">{fixture.color}</span>
          </div>
        </div>
        <label className={cx('col-span-2 flex items-center gap-2 text-sm', !spec.canUnblock && 'opacity-60')}>
          <input type="checkbox" className={checkbox} checked={fixture.blocksPlacement} disabled={!spec.canUnblock} onChange={(e) => updateFixture(fixture.id, { blocksPlacement: e.target.checked })} />
          {t.fixture.blocksPlacement}
        </label>
        <label className="col-span-2 flex items-center gap-2 text-sm">
          <input type="checkbox" className={checkbox} checked={fixture.locked} onChange={(e) => updateFixture(fixture.id, { locked: e.target.checked })} />
          {t.fixture.locked}
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={cx(btn.base, btn.secondary, btn.small)} onClick={() => duplicateElements([fixture.id])}>
          {t.table.duplicate}
        </button>
        <button type="button" className={cx(btn.base, btn.danger, btn.small)} onClick={() => void deleteElements([fixture.id])}>
          {t.fixture.remove}
        </button>
      </div>
    </div>
  );
}
