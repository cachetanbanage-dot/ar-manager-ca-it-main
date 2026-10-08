// R10: the as-at date. Every page reads ?asof=YYYY-MM-DD from the URL; when it
// is missing or not a real date, the as-at date is today in India.
// Used on the server (pages) and in the browser (the header date picker).

/** Today's date in Asia/Kolkata as 'YYYY-MM-DD'. Vercel's servers run in UTC, so never use the server's own date. */
export function todayInIndia(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** True for a real calendar date written as 'YYYY-MM-DD' (so '2026-02-30' is false). */
export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** The ?asof= value from the URL if it is a real date, else undefined (links then default to today). */
export function asofParam(value: string | string[] | null | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v && isValidDate(v) ? v : undefined;
}

/** A link that keeps the as-at date, e.g. hrefWithAsOf('/invoices?customer=3', '2026-08-31'). */
export function hrefWithAsOf(href: string, asof: string | null | undefined): string {
  if (!asof) return href;
  return `${href}${href.includes('?') ? '&' : '?'}asof=${asof}`;
}

/** The as-at date from a ?asof= value, or today in India when it is missing or invalid. */
export function parseAsOf(value: string | string[] | null | undefined, now: Date = new Date()): string {
  const v = Array.isArray(value) ? value[0] : value;
  return v && isValidDate(v) ? v : todayInIndia(now);
}
