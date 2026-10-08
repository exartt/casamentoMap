import { describe, expect, it } from 'vitest';
import { applyImport, decodeGuestFile, defaultMapping, parseGuestCsv, parsePastedNames, prepareImport } from '@client/csv/parseGuests';
import { createEmptyProject } from '@shared/domain/projectMigration';
import { createTable } from '@shared/domain/seating';

function bytesOf(text: string, bom = false): Uint8Array {
  const body = new TextEncoder().encode(text);
  if (!bom) return body;
  return new Uint8Array([0xef, 0xbb, 0xbf, ...body]);
}

describe('csv import', () => {
  it('parses semicolon and comma delimiters', () => {
    const a = parseGuestCsv('nome;grupo\nAna;Família\nBruno;Amigos\n');
    expect(a.delimiter).toBe(';');
    expect(a.headers).toEqual(['nome', 'grupo']);
    expect(a.rows).toHaveLength(2);
    const b = parseGuestCsv('nome,grupo\nAna,Família\n');
    expect(b.delimiter).toBe(',');
    expect(b.rows[0]).toEqual(['Ana', 'Família']);
  });

  it('removes the UTF-8 BOM', () => {
    const text = decodeGuestFile(bytesOf('nome;grupo\nJoão;Família\n', true));
    const parsed = parseGuestCsv(text);
    expect(parsed.headers?.[0]).toBe('nome');
    expect(parsed.rows[0][0]).toBe('João');
  });

  it('falls back to windows-1252 for João and Conceição', () => {
    const latin = new Uint8Array([0x6e, 0x6f, 0x6d, 0x65, 0x0a, 0x4a, 0x6f, 0xe3, 0x6f, 0x0a, 0x43, 0x6f, 0x6e, 0x63, 0x65, 0x69, 0xe7, 0xe3, 0x6f, 0x0a]);
    const text = decodeGuestFile(latin);
    expect(text).toContain('João');
    expect(text).toContain('Conceição');
    const parsed = parseGuestCsv(text);
    expect(parsed.rows.map((r) => r[0])).toEqual(['João', 'Conceição']);
  });

  it('treats a single column without header as names', () => {
    const parsed = parseGuestCsv('Ana\nBruno\n\nCarla\n');
    expect(parsed.headers).toBeNull();
    expect(parsed.rows).toHaveLength(3);
    expect(parsed.emptyLines).toBeGreaterThanOrEqual(1);
    const mapping = defaultMapping(parsed);
    expect(mapping.name).toBe(0);
  });

  it('recognizes header synonyms without accents or case', () => {
    const parsed = parseGuestCsv('Convidado;Família;Lado;Criança;Restrição;Observações;Mesa\nAna;Noiva;noiva;sim;vegana;chega cedo;Mesa 1\n');
    const mapping = defaultMapping(parsed);
    expect(mapping).toEqual({ name: 0, group: 1, side: 2, isChild: 3, dietary: 4, notes: 5, table: 6 });
    const prepared = prepareImport(parsed, mapping, [], 'append');
    expect(prepared.guests[0]).toMatchObject({ name: 'Ana', group: 'Noiva', side: 'bride', isChild: true, dietary: 'vegana', notes: 'chega cedo' });
    expect(prepared.tableByGuestId.get(prepared.guests[0].id)).toBe('Mesa 1');
  });

  it('detects duplicates and ignores empty lines', () => {
    const parsed = parseGuestCsv('nome\nJoão Silva\n\njoao  silva\nMaria\n');
    expect(parsed.emptyLines).toBe(1);
    const prepared = prepareImport(parsed, defaultMapping(parsed), [{ id: 'g1', name: 'MARIA' }], 'append');
    expect(prepared.guests.map((g) => g.name)).toEqual(['João Silva']);
    expect(prepared.duplicates).toEqual(['joao  silva', 'Maria']);
  });

  it('applies the import with pre-allocation by table label or number', () => {
    const project = createEmptyProject('Teste');
    project.tables = [createTable('t1', 'square', { x: 3, y: 3 }, 'Mesa 1'), createTable('t2', 'square', { x: 8, y: 3 }, 'Mesa 2')];
    const parsed = parseGuestCsv('nome;mesa\nAna;Mesa 1\nBruno;2\nCarla;Mesa 9\n');
    const prepared = prepareImport(parsed, defaultMapping(parsed), [], 'append');
    const { project: next, summary } = applyImport(project, prepared, 'append', false);
    expect(summary.imported).toBe(3);
    expect(summary.preAllocated).toBe(2);
    expect(summary.errors[0]).toContain('Mesa "Mesa 9" não encontrada');
    expect(next.tables[0].seats.some((s) => s.guestId !== null)).toBe(true);
    expect(next.tables[1].seats.some((s) => s.guestId !== null)).toBe(true);
  });

  it('replace mode frees seats and drops the old list', () => {
    const project = createEmptyProject('Teste');
    project.tables = [createTable('t1', 'square', { x: 3, y: 3 }, 'Mesa 1')];
    project.guests = [{ id: 'g1', name: 'Antiga' }];
    project.tables[0].seats[0].guestId = 'g1';
    const parsed = parsePastedNames('Nova\nOutra\n');
    const prepared = prepareImport(parsed, defaultMapping(parsed), project.guests, 'replace');
    const { project: next } = applyImport(project, prepared, 'replace', false);
    expect(next.guests.map((g) => g.name)).toEqual(['Nova', 'Outra']);
    expect(next.tables[0].seats[0].guestId).toBeNull();
  });
});
