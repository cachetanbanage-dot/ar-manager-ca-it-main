/** A link with query parameters; blank values are left out. buildHref('/customers', { q: 'pune', asof: undefined }) → '/customers?q=pune' */
export function buildHref(path: string, params: Record<string, string | number | null | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  const query = sp.toString();
  return query ? `${path}?${query}` : path;
}
