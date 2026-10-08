// Sorting and searching for list screens. Presentation only — no amounts are calculated here.

export type SortDir = 'asc' | 'desc';

/** Sorts a copy of rows by one value. Blanks (null) always go last. */
export function sortRows<T>(rows: T[], value: (row: T) => string | number | boolean | null, dir: SortDir): T[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = value(a);
    const y = value(b);
    if (x === y) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    if (typeof x === 'string' && typeof y === 'string') return sign * x.localeCompare(y, 'en', { sensitivity: 'base' });
    return sign * (x < y ? -1 : 1);
  });
}

/** True when any of the fields contains the search text, ignoring case. An empty search matches everything. */
export function matchesSearch(search: string, fields: (string | null | undefined)[]): boolean {
  const q = search.trim().toLowerCase();
  return q === '' || fields.some((f) => f?.toLowerCase().includes(q));
}
