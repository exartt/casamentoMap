import Papa from 'papaparse';
import { assignGuestToTable, findTableByLabel } from '@shared/domain/seating';
import { dedupeKey, normalizeText } from '@shared/domain/text';
import type { Guest, GuestSide, ProjectData } from '@shared/domain/types';

export type ImportField = 'name' | 'group' | 'side' | 'isChild' | 'dietary' | 'notes' | 'table';

export type ColumnMapping = Partial<Record<ImportField, number>>;

export type ParsedCsv = {
  headers: string[] | null;
  rows: string[][];
  emptyLines: number;
  delimiter: string;
  columnCount: number;
};

export type ImportMode = 'append' | 'replace';

export type PreparedImport = {
  guests: Guest[];
  tableByGuestId: Map<string, string>;
  duplicates: string[];
  invalidRows: number;
};

export type ImportSummary = {
  imported: number;
  duplicatesSkipped: number;
  preAllocated: number;
  errors: string[];
};

const FIELD_SYNONYMS: Record<ImportField, string[]> = {
  name: ['nome', 'convidado', 'name', 'convidada', 'guest'],
  group: ['grupo', 'familia', 'categoria', 'group'],
  side: ['lado', 'side'],
  isChild: ['crianca', 'infantil', 'child'],
  dietary: ['restricao', 'dieta', 'alimentacao', 'restricoes', 'dietary'],
  notes: ['obs', 'observacoes', 'observacao', 'notes'],
  table: ['mesa', 'table'],
};

const TRUE_VALUES = new Set(['sim', 's', 'x', '1', 'true', 'yes', 'y', 'crianca']);

const REPLACEMENT_CHAR = '�';

/** Decodes a guest file as UTF-8 (without BOM) and falls back to windows-1252 when it contains U+FFFD. */
export function decodeGuestFile(bytes: ArrayBuffer | Uint8Array): string {
  const utf8 = new TextDecoder('utf-8').decode(bytes);
  if (!utf8.includes(REPLACEMENT_CHAR)) return utf8;
  return new TextDecoder('windows-1252').decode(bytes);
}

/** Maps a header cell to an import field using accent-insensitive synonyms. */
export function fieldForHeader(header: string): ImportField | null {
  const key = normalizeText(header);
  for (const field of Object.keys(FIELD_SYNONYMS) as ImportField[]) {
    if (FIELD_SYNONYMS[field].includes(key)) return field;
  }
  return null;
}

/** Picks the delimiter (; , or tab) that splits the first lines into the most consistent column count. */
export function detectDelimiter(text: string): string {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '').slice(0, 20);
  let best = ';';
  let bestScore = -1;
  for (const candidate of [';', ',', '\t']) {
    const counts = lines.map((l) => l.split(candidate).length - 1);
    const total = counts.reduce((a, b) => a + b, 0);
    if (total === 0) continue;
    const consistent = counts.every((c) => c === counts[0]);
    const score = total + (consistent ? 1000 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best;
}

/** Parses CSV text, detecting the delimiter and whether the first line is a header. */
export function parseGuestCsv(text: string, options: { hasHeader?: boolean } = {}): ParsedCsv {
  const cleaned = text.replace(/^\uFEFF/, '');
  const delimiter = detectDelimiter(cleaned);
  const result = Papa.parse<string[]>(cleaned, {
    delimiter,
    skipEmptyLines: false,
    transform: (value) => value.trim(),
  });
  const allRows = result.data.filter((row) => Array.isArray(row));
  let emptyLines = 0;
  const rows: string[][] = [];
  allRows.forEach((row, index) => {
    if (row.every((cell) => cell === '')) {
      if (index < allRows.length - 1) emptyLines += 1;
      return;
    }
    rows.push(row);
  });
  if (rows.length === 0) return { headers: null, rows: [], emptyLines, delimiter, columnCount: 0 };
  const columnCount = Math.max(...rows.map((r) => r.length));
  const first = rows[0];
  const autoHeader = first.some((cell) => fieldForHeader(cell) !== null);
  const hasHeader = options.hasHeader ?? autoHeader;
  if (hasHeader) {
    return { headers: first, rows: rows.slice(1).map((r) => padRow(r, columnCount)), emptyLines, delimiter, columnCount };
  }
  return { headers: null, rows: rows.map((r) => padRow(r, columnCount)), emptyLines, delimiter, columnCount };
}

function padRow(row: string[], count: number): string[] {
  if (row.length >= count) return row;
  return [...row, ...Array.from({ length: count - row.length }, () => '')];
}

/** Builds the default column mapping from the headers, or name = first column without a header. */
export function defaultMapping(parsed: ParsedCsv): ColumnMapping {
  const mapping: ColumnMapping = {};
  if (parsed.headers) {
    parsed.headers.forEach((header, index) => {
      const field = fieldForHeader(header);
      if (field && mapping[field] === undefined) mapping[field] = index;
    });
    if (mapping.name === undefined && parsed.columnCount > 0) mapping.name = 0;
    return mapping;
  }
  if (parsed.columnCount > 0) mapping.name = 0;
  return mapping;
}

/** Parses the "lado" column into a guest side. */
export function parseSide(value: string): GuestSide | undefined {
  const key = normalizeText(value);
  if (key === '') return undefined;
  if (key.startsWith('noiva') || key === 'bride') return 'bride';
  if (key.startsWith('noivo') || key === 'groom') return 'groom';
  if (key.startsWith('ambos') || key === 'both' || key === 'os dois') return 'both';
  return undefined;
}

/** Parses the "criança" column into a boolean. */
export function parseBoolean(value: string): boolean {
  return TRUE_VALUES.has(normalizeText(value));
}

/** Converts parsed rows into guests, detecting duplicates against the file and the existing list. */
export function prepareImport(parsed: ParsedCsv, mapping: ColumnMapping, existing: Guest[], mode: ImportMode): PreparedImport {
  const guests: Guest[] = [];
  const tableByGuestId = new Map<string, string>();
  const duplicates: string[] = [];
  const seen = new Set<string>();
  if (mode === 'append') for (const g of existing) seen.add(dedupeKey(g.name));
  let invalidRows = 0;
  const nameIndex = mapping.name;
  if (nameIndex === undefined) return { guests, tableByGuestId, duplicates, invalidRows: parsed.rows.length };
  const cell = (row: string[], field: ImportField): string => {
    const index = mapping[field];
    return index === undefined ? '' : (row[index] ?? '').trim();
  };
  for (const row of parsed.rows) {
    const name = (row[nameIndex] ?? '').trim();
    if (name === '') {
      invalidRows += 1;
      continue;
    }
    const key = dedupeKey(name);
    if (seen.has(key)) {
      duplicates.push(name);
      continue;
    }
    seen.add(key);
    const guest: Guest = { id: crypto.randomUUID(), name };
    const group = cell(row, 'group');
    if (group) guest.group = group;
    const side = parseSide(cell(row, 'side'));
    if (side) guest.side = side;
    if (parseBoolean(cell(row, 'isChild'))) guest.isChild = true;
    const dietary = cell(row, 'dietary');
    if (dietary) guest.dietary = dietary;
    const notes = cell(row, 'notes');
    if (notes) guest.notes = notes;
    const table = cell(row, 'table');
    if (table) tableByGuestId.set(guest.id, table);
    guests.push(guest);
  }
  return { guests, tableByGuestId, duplicates, invalidRows };
}

/** Applies a prepared import to the project, returning the new document and a summary. */
export function applyImport(
  project: ProjectData,
  prepared: PreparedImport,
  mode: ImportMode,
  keepDuplicates: boolean,
): { project: ProjectData; summary: ImportSummary } {
  let next: ProjectData = mode === 'replace' ? { ...project, guests: [], tables: project.tables.map((t) => ({ ...t, seats: t.seats.map((s) => ({ ...s, guestId: null })) })) } : project;
  let guests = prepared.guests;
  let duplicatesSkipped = prepared.duplicates.length;
  if (keepDuplicates) {
    guests = [...guests, ...prepared.duplicates.map((name) => ({ id: crypto.randomUUID(), name }))];
    duplicatesSkipped = 0;
  }
  next = { ...next, guests: [...next.guests, ...guests] };
  const notFound = new Map<string, number>();
  const full = new Map<string, number>();
  let preAllocated = 0;
  for (const guest of guests) {
    const label = prepared.tableByGuestId.get(guest.id);
    if (!label) continue;
    const table = findTableByLabel(next.tables, label);
    if (!table) {
      notFound.set(label, (notFound.get(label) ?? 0) + 1);
      continue;
    }
    const result = assignGuestToTable(next, table.id, guest.id);
    if (!result.ok) {
      full.set(table.label, (full.get(table.label) ?? 0) + 1);
      continue;
    }
    next = result.project;
    preAllocated += 1;
  }
  const errors: string[] = [];
  for (const [label, n] of notFound) errors.push(`Mesa "${label}" não encontrada (${n} convidado(s))`);
  for (const [label, n] of full) errors.push(`Mesa "${label}" cheia (${n} convidado(s) ficaram sem lugar)`);
  return { project: next, summary: { imported: guests.length, duplicatesSkipped, preAllocated, errors } };
}

/** Parses a pasted list with one name per line. */
export function parsePastedNames(text: string): ParsedCsv {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const rows = lines.filter((l) => l !== '').map((l) => [l]);
  return { headers: null, rows, emptyLines: lines.length - rows.length, delimiter: '\n', columnCount: 1 };
}
