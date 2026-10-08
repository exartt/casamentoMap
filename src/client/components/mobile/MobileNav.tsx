import type { ReactNode } from 'react';
import type { ProjectData } from '@shared/domain/types';
import { t } from '../../i18n/strings';
import { getDerived } from '../../store/derived';
import { useUiStore, type MobilePanel } from '../../store/uiStore';
import { cx } from '../common/ui';

type Props = { project: ProjectData };

const ICON_PROPS = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const ICONS: Record<MobilePanel, ReactNode> = {
  palette: (
    <svg {...ICON_PROPS} aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  guests: (
    <svg {...ICON_PROPS} aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M16 14.2c2.3.2 4 1.8 4.5 4.8" />
    </svg>
  ),
  properties: (
    <svg {...ICON_PROPS} aria-hidden="true">
      <rect x="4" y="9" width="16" height="6" rx="1.5" />
      <path d="M7 5.5v2M12 5.5v2M17 5.5v2M7 16.5v2M12 16.5v2M17 16.5v2" />
    </svg>
  ),
  warnings: (
    <svg {...ICON_PROPS} aria-hidden="true">
      <path d="M12 4 2.8 19.5h18.4L12 4Z" />
      <path d="M12 10v4.2M12 17v.01" />
    </svg>
  ),
  versions: (
    <svg {...ICON_PROPS} aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  ),
};

const ITEMS: Array<{ id: MobilePanel; label: string }> = [
  { id: 'palette', label: t.mobile.navAdd },
  { id: 'guests', label: t.mobile.navGuests },
  { id: 'properties', label: t.mobile.navProperties },
  { id: 'warnings', label: t.mobile.navWarnings },
  { id: 'versions', label: t.mobile.navVersions },
];

/** Bottom navigation for phones and tablets; each item toggles its panel sheet. */
export function MobileNav({ project }: Props) {
  const mobilePanel = useUiStore((s) => s.mobilePanel);
  const setMobilePanel = useUiStore((s) => s.setMobilePanel);
  const warningCount = getDerived(project).warnings.length;
  return (
    <nav className="grid grid-cols-5 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)]" aria-label="Navegação">
      {ITEMS.map((item) => {
        const active = mobilePanel === item.id;
        return (
          <button
            key={item.id}
            type="button"
            className={cx('relative flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium [@media(max-height:500px)]:h-11 [@media(max-height:500px)]:flex-row [@media(max-height:500px)]:gap-3 [@media(max-height:500px)]:text-xs', active ? 'text-brand-700' : 'text-gray-600')}
            aria-pressed={active}
            onClick={() => setMobilePanel(active ? null : item.id)}
          >
            {active && <span className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-brand-600" aria-hidden="true" />}
            <span className="relative">
              {ICONS[item.id]}
              {item.id === 'warnings' && warningCount > 0 && (
                <span className="absolute -right-2.5 -top-1.5 min-w-[18px] rounded-full bg-red-600 px-1 text-center text-[10px] leading-[18px] text-white">{warningCount}</span>
              )}
            </span>
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
