/** Lowercases, strips diacritics and collapses whitespace so searches ignore case and accents. */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Returns true when every word of the query appears in the normalized haystack. */
export function matchesSearch(haystack: string, query: string): boolean {
  const needle = normalizeText(query);
  if (needle === '') return true;
  const text = normalizeText(haystack);
  return needle.split(' ').every((word) => text.includes(word));
}

/** Builds a key for duplicate detection: accent-insensitive, case-insensitive, whitespace-normalized. */
export function dedupeKey(name: string): string {
  return normalizeText(name);
}

/** Formats a number with a fixed number of decimals using a comma as the decimal separator. */
export function formatDecimal(value: number, decimals = 2): string {
  return value.toFixed(decimals).replace('.', ',');
}

/** Formats a length in meters for display, e.g. "2,80 m". */
export function formatMeters(value: number, decimals = 2): string {
  return `${formatDecimal(value, decimals)} m`;
}

/** Parses a decimal typed by the user, accepting both comma and point as separators. */
export function parseDecimal(input: string): number | null {
  const cleaned = input.trim().replace(/\s/g, '').replace(',', '.');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  if (!/^-?\d*(\.\d*)?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/** Rounds a number to the given number of decimal places. */
export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Returns singular or plural form according to the count, e.g. plural(2, 'mesa', 'mesas'). */
export function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** Joins a list in pt-BR style: "a, b e c". */
export function joinPt(parts: string[]): string {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}`;
}

/** Compares two names using pt-BR collation for alphabetical lists. */
export function compareNames(a: string, b: string): number {
  return a.localeCompare(b, 'pt-BR', { sensitivity: 'base' });
}
