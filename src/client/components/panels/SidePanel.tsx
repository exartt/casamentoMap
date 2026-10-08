import type { ProjectData } from '@shared/domain/types';
import { t } from '../../i18n/strings';
import { getDerived } from '../../store/derived';
import { useUiStore, type PanelTab } from '../../store/uiStore';
import { cx } from '../common/ui';
import { GuestsPanel } from './GuestsPanel';
import { PropertiesPanel } from './PropertiesPanel';
import { VersionsPanel } from './VersionsPanel';
import { WarningsPanel } from './WarningsPanel';

type Props = { project: ProjectData };

const TABS: Array<{ id: PanelTab; label: string }> = [
  { id: 'guests', label: t.panels.guests },
  { id: 'properties', label: t.panels.properties },
  { id: 'warnings', label: t.panels.warnings },
  { id: 'versions', label: t.panels.versions },
];

/** Right side panel with the four tabs: guests, properties, warnings and versions. */
export function SidePanel({ project }: Props) {
  const activeTab = useUiStore((s) => s.activeTab);
  const setActiveTab = useUiStore((s) => s.setActiveTab);
  const warningCount = getDerived(project).warnings.length;
  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l border-gray-200 bg-white" aria-label="Painel lateral">
      <div className="flex border-b border-gray-200" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={cx(
              'flex-1 border-b-2 px-1 py-2 text-xs font-medium',
              activeTab === tab.id ? 'border-brand-600 text-brand-800' : 'border-transparent text-gray-600 hover:text-gray-900',
            )}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.id === 'warnings' && warningCount > 0 && (
              <span className="ml-1 rounded-full bg-red-100 px-1.5 text-[10px] text-red-800">{warningCount}</span>
            )}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3" role="tabpanel">
        {activeTab === 'guests' && <GuestsPanel project={project} />}
        {activeTab === 'properties' && <PropertiesPanel project={project} />}
        {activeTab === 'warnings' && <WarningsPanel project={project} />}
        {activeTab === 'versions' && <VersionsPanel />}
      </div>
    </aside>
  );
}
