import { useEffect, useMemo, useState } from 'react';
import type { PublicProjectResponse } from '@shared/api/schemas';
import type { ProjectData } from '@shared/domain/types';
import { EventDayView } from '../components/event/EventDayView';
import { formatWhen } from '../i18n/format';
import { t } from '../i18n/strings';
import { api, errorMessage } from '../persistence/apiClient';

type Props = { token: string };

/** Read-only page for share links: the event-day view fed by the last saved version. */
export function PublicView({ token }: Props) {
  const [data, setData] = useState<PublicProjectResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getPublic(token)
      .then(setData)
      .catch((e: unknown) => setError(errorMessage(e, t.publicView.invalid)));
  }, [token]);

  const project: ProjectData | null = useMemo(() => (data ? ({ ...data.data, guests: data.data.guests } as ProjectData) : null), [data]);

  if (error) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-gray-100 p-6 text-center">
        <p className="text-gray-700">{error}</p>
      </main>
    );
  }
  if (!project || !data) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-gray-100 p-6 text-center">
        <p className="text-gray-600">{t.app.loading}</p>
      </main>
    );
  }
  return <EventDayView project={project} subtitle={t.publicView.updated(formatWhen(data.savedAt))} />;
}
