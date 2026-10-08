const TIME_FORMAT = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

const DATE_FORMAT = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Formats an instant relative to now: "hoje às 10:42", "ontem às 09:10" or "07/10/2026 às 10:42". */
export function formatWhen(iso: string | Date, now: Date = new Date()): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return '';
  const time = TIME_FORMAT.format(date);
  if (sameDay(date, now)) return `hoje às ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(date, yesterday)) return `ontem às ${time}`;
  return `${DATE_FORMAT.format(date)} às ${time}`;
}

/** Formats an instant as a short date and time, e.g. "07/10/2026 10:42". */
export function formatDateTime(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return '';
  return `${DATE_FORMAT.format(date)} ${TIME_FORMAT.format(date)}`;
}

/** Formats a time of day, e.g. "10:42". */
export function formatTime(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return '';
  return TIME_FORMAT.format(date);
}
