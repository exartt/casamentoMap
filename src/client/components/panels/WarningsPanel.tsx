import type { LayoutWarning } from '@shared/domain/layoutValidation';
import type { ProjectData } from '@shared/domain/types';
import { t } from '../../i18n/strings';
import { getDerived } from '../../store/derived';
import { useProjectStore } from '../../store/projectStore';
import { useUiStore } from '../../store/uiStore';
import { cx } from '../common/ui';

type Props = { project: ProjectData };

const KIND_LABEL: Record<LayoutWarning['kind'], string> = {
  overlap: t.warnings.overlap,
  aisle: t.warnings.aisle,
  outside: t.warnings.outside,
  doorBlocked: t.warnings.doorBlocked,
};

const SEVERITY_CLASS: Record<LayoutWarning['severity'], string> = {
  critical: 'border-red-800 bg-red-100 text-red-900',
  error: 'border-red-300 bg-red-50 text-red-900',
  warning: 'border-amber-300 bg-amber-50 text-amber-900',
};

const ORDER: Record<LayoutWarning['severity'], number> = { critical: 0, error: 1, warning: 2 };

/** Lists layout warnings; clicking one selects and centers the element. */
export function WarningsPanel({ project }: Props) {
  const warnings = [...getDerived(project).warnings].sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
  const setSelection = useProjectStore((s) => s.setSelection);
  const requestFocus = useUiStore((s) => s.requestFocus);
  if (warnings.length === 0) return <p className="text-sm text-gray-600">{t.warnings.empty}</p>;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-gray-500">{t.warnings.count(warnings.length)}</p>
      <ul className="flex flex-col gap-1.5">
        {warnings.map((w) => (
          <li key={w.id}>
            <button
              type="button"
              className={cx('w-full rounded-md border px-2.5 py-1.5 text-left text-sm hover:brightness-95', SEVERITY_CLASS[w.severity])}
              onClick={() => {
                setSelection([w.element.id]);
                requestFocus(w.element);
              }}
            >
              <span className="block text-xs font-semibold uppercase tracking-wide opacity-80">{KIND_LABEL[w.kind]}</span>
              <span>{w.message}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
