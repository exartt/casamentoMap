import { useState } from 'react';
import { LIMITS } from '@shared/config/defaults';
import type { ElementRef, ProjectData } from '@shared/domain/types';
import { useCompactLayout } from '../../hooks/useMediaQuery';
import { t } from '../../i18n/strings';
import { renameProject, resizeVenue } from '../../store/actions';
import { NumberField } from '../common/NumberField';
import { input, label } from '../common/ui';
import { OutsideElementsDialog } from '../dialogs/OutsideElementsDialog';

type Props = { project: ProjectData };

/** Project and venue properties, shown when nothing is selected. */
export function VenuePanel({ project }: Props) {
  const [outside, setOutside] = useState<ElementRef[] | null>(null);
  const compact = useCompactLayout();

  const resize = (patch: Partial<ProjectData['venue']>) => {
    const refs = resizeVenue({ ...project.venue, ...patch });
    if (refs.length > 0) setOutside(refs);
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className={label}>{t.venue.projectName}</label>
        <input className={input} value={project.name} maxLength={LIMITS.maxProjectNameLength} onChange={(e) => renameProject(e.target.value)} />
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-800">{t.venue.title}</h3>
        <div className="grid grid-cols-2 gap-2">
          <NumberField label={t.venue.width} value={project.venue.widthM} min={LIMITS.minVenueM} max={LIMITS.maxVenueM} step={0.5} suffix="m" onChange={(v) => resize({ widthM: v })} />
          <NumberField label={t.venue.depth} value={project.venue.depthM} min={LIMITS.minVenueM} max={LIMITS.maxVenueM} step={0.5} suffix="m" onChange={(v) => resize({ depthM: v })} />
        </div>
      </div>
      <p className="text-xs text-gray-500">{compact ? t.venue.hintTouch : t.venue.hint}</p>
      {!compact && (
      <div className="rounded-md bg-gray-50 p-2 text-xs text-gray-600">
        <h3 className="mb-1 font-semibold">{t.shortcuts.title}</h3>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
          {t.shortcuts.list.map(([key, desc]) => (
            <div key={key} className="contents">
              <dt className="font-mono">{key}</dt>
              <dd>{desc}</dd>
            </div>
          ))}
        </dl>
      </div>
      )}
      {outside && <OutsideElementsDialog refs={outside} project={project} onClose={() => setOutside(null)} />}
    </div>
  );
}
