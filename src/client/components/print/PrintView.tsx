import { guestSeatMap } from '@shared/domain/seating';
import { compareNames } from '@shared/domain/text';
import type { ProjectData } from '@shared/domain/types';
import { formatDateTime } from '../../i18n/format';
import { t } from '../../i18n/strings';
import { getDerived } from '../../store/derived';

type Props = { project: ProjectData; planImage: string | null };

/** Print-only layout: the plan, one section per table and the alphabetical "find your table" list. */
export function PrintView({ project, planImage }: Props) {
  const derived = getDerived(project);
  const seatMap = guestSeatMap(project);
  const alphabetical = [...project.guests].sort((a, b) => compareNames(a.name, b.name));
  return (
    <div className="print-view hidden print:block" aria-hidden="true">
      <section className="print-page">
        <h1 className="text-2xl font-semibold">{project.name}</h1>
        <p className="text-sm text-gray-600">
          {t.print.plan} · {formatDateTime(new Date())}
        </p>
        {planImage && <img src={planImage} alt={t.print.plan} className="mt-4 w-full" />}
      </section>

      <section className="print-page">
        <h2 className="mb-3 text-xl font-semibold">{t.print.byTable}</h2>
        <div className="print-columns">
          {project.tables.map((table) => (
            <div key={table.id} className="print-table-block">
              <h3 className="text-base font-semibold">{table.label}</h3>
              <ol className="text-sm">
                {table.seats.map((seat) => {
                  const guest = seat.guestId ? derived.guestsById.get(seat.guestId) : undefined;
                  return (
                    <li key={seat.index} className="flex gap-2">
                      <span className="w-6 text-right tabular-nums text-gray-500">{seat.index + 1}.</span>
                      <span className={!seat.enabled ? 'text-gray-400' : guest ? '' : 'text-gray-400'}>
                        {!seat.enabled ? t.print.disabledSeat : guest ? guest.name : t.print.emptySeat}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      </section>

      <section className="print-page">
        <h2 className="mb-3 text-xl font-semibold">{t.print.findYourTable}</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-400 text-left">
              <th className="py-1 pr-2">{t.print.guest}</th>
              <th className="py-1 pr-2">{t.print.table}</th>
              <th className="py-1">{t.print.seat}</th>
            </tr>
          </thead>
          <tbody>
            {alphabetical.map((g) => {
              const loc = seatMap.get(g.id);
              const table = loc ? derived.tablesById.get(loc.tableId) : undefined;
              return (
                <tr key={g.id} className="border-b border-gray-200">
                  <td className="py-0.5 pr-2">{g.name}</td>
                  <td className="py-0.5 pr-2">{table ? table.label : '—'}</td>
                  <td className="py-0.5">{loc ? loc.seatIndex + 1 : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
