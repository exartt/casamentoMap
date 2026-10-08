import { guestSeatMap } from '@shared/domain/seating';
import { compareNames } from '@shared/domain/text';
import type { ProjectData } from '@shared/domain/types';
import { dateStamp, downloadBlob, fileSlug } from './download';

const DELIMITER = ';';

const BOM = '﻿';

const HEADER = ['nome', 'grupo', 'mesa', 'assento'];

function escapeCell(value: string): string {
  if (value.includes(DELIMITER) || value.includes('"') || value.includes('\n')) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Builds the seating CSV (name; group; table; seat) sorted by name. */
export function buildSeatingCsv(project: ProjectData): string {
  const seatMap = guestSeatMap(project);
  const tables = new Map(project.tables.map((t) => [t.id, t.label] as const));
  const rows = [...project.guests]
    .sort((a, b) => compareNames(a.name, b.name))
    .map((g) => {
      const loc = seatMap.get(g.id);
      return [g.name, g.group ?? '', loc ? tables.get(loc.tableId) ?? '' : '', loc ? String(loc.seatIndex + 1) : ''];
    });
  const lines = [HEADER, ...rows].map((row) => row.map(escapeCell).join(DELIMITER));
  return lines.join('\r\n') + '\r\n';
}

/** Downloads the seating CSV with BOM so Excel pt-BR opens it correctly. */
export function exportSeatingCsv(project: ProjectData): void {
  const blob = new Blob([BOM + buildSeatingCsv(project)], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, `lugares-${fileSlug(project.name)}-${dateStamp()}.csv`);
}

/** CSV template with header and three example rows for the import dialog. */
export function buildCsvTemplate(): string {
  const lines = [
    ['nome', 'grupo', 'lado', 'crianca', 'restricao', 'obs', 'mesa'],
    ['Maria da Silva', 'Família da noiva', 'noiva', 'nao', 'vegetariana', '', 'Mesa 1'],
    ['João Pereira', 'Amigos do noivo', 'noivo', 'nao', '', 'chega tarde', ''],
    ['Ana Conceição', 'Família do noivo', 'noivo', 'sim', '', '', '2'],
  ];
  return lines.map((row) => row.map(escapeCell).join(DELIMITER)).join('\r\n') + '\r\n';
}

/** Downloads the CSV template. */
export function downloadCsvTemplate(): void {
  const blob = new Blob([BOM + buildCsvTemplate()], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, 'modelo-convidados.csv');
}
