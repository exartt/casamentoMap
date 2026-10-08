import { TABLE_SPECS } from '../config/defaults';
import { projectDataSchema } from './projectSchema';
import type { ProjectData } from './types';

export type ValidationResult = { ok: true; data: ProjectData } | { ok: false; problems: string[] };

/** Validates the schema and the integrity rules of a project document. */
export function validateProject(input: unknown): ValidationResult {
  const parsed = projectDataSchema.safeParse(input);
  if (!parsed.success) {
    const problems = parsed.error.issues.slice(0, 20).map((issue) => `${issue.path.join('.') || 'documento'}: ${issue.message}`);
    return { ok: false, problems };
  }
  const data = parsed.data as ProjectData;
  const problems = integrityProblems(data);
  return problems.length === 0 ? { ok: true, data } : { ok: false, problems };
}

/** Lists integrity problems of an already schema-valid document. */
export function integrityProblems(data: ProjectData): string[] {
  const problems: string[] = [];
  const guestIds = new Set<string>();
  for (const g of data.guests) {
    if (guestIds.has(g.id)) problems.push(`Convidado com id duplicado: ${g.id}`);
    guestIds.add(g.id);
  }
  const elementIds = new Set<string>();
  for (const list of [data.tables, data.fixtures, data.doors] as Array<Array<{ id: string }>>) {
    for (const el of list) {
      if (elementIds.has(el.id)) problems.push(`Elemento com id duplicado: ${el.id}`);
      elementIds.add(el.id);
    }
  }
  const seatedGuests = new Map<string, string>();
  for (const table of data.tables) {
    const spec = TABLE_SPECS[table.kind];
    if (table.seats.length !== spec.capacity) {
      problems.push(`${table.label}: quantidade de assentos inválida (${table.seats.length}, esperado ${spec.capacity})`);
    }
    const indexes = new Set<number>();
    let occupied = 0;
    for (const seat of table.seats) {
      if (indexes.has(seat.index)) problems.push(`${table.label}: assento ${seat.index + 1} repetido`);
      indexes.add(seat.index);
      if (seat.index >= spec.capacity) problems.push(`${table.label}: índice de assento fora do limite`);
      if (seat.guestId === null) continue;
      if (!seat.enabled) problems.push(`${table.label}: assento ${seat.index + 1} desativado está ocupado`);
      if (!guestIds.has(seat.guestId)) problems.push(`${table.label}: assento ${seat.index + 1} aponta para convidado inexistente`);
      const previous = seatedGuests.get(seat.guestId);
      if (previous) problems.push(`Convidado em dois assentos (${previous} e ${table.label})`);
      seatedGuests.set(seat.guestId, table.label);
      occupied += 1;
    }
    if (occupied > spec.capacity) problems.push(`${table.label}: ocupação acima da capacidade (${occupied}/${spec.capacity})`);
  }
  return problems;
}
