// Date arithmetic on 'YYYY-MM-DD' strings. Never uses local time, so the
// results are the same on a laptop in Pune and a Vercel server in UTC.

function toUtc(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Whole days from one 'YYYY-MM-DD' date to another. Never uses local time. */
export function daysBetween(from: string, to: string): number {
  return (toUtc(to) - toUtc(from)) / 86_400_000;
}

/** The date n calendar days after (or, for negative n, before) a 'YYYY-MM-DD' date. */
export function addDays(date: string, n: number): string {
  return new Date(toUtc(date) + n * 86_400_000).toISOString().slice(0, 10);
}

/** R2: due date = invoice date + the customer's credit days, in calendar days. */
export function dueDate(invoiceDate: string, creditDays: number): string {
  return addDays(invoiceDate, creditDays);
}

/** R4: the Indian financial year (April to March) of a date, e.g. '2026-04-05' → '26-27'. */
export function fyLabel(date: string): string {
  const [y, m] = date.split('-').map(Number);
  const start = m >= 4 ? y : y - 1;
  const yy = (n: number) => String(n % 100).padStart(2, '0');
  return `${yy(start)}-${yy(start + 1)}`;
}
