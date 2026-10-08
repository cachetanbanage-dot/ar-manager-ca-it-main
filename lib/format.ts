// R18: how amounts and dates are shown. These only format — they never calculate.
import type { Paise } from './ar/types';

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

/** Whole paise as ₹1,23,456.00 (Indian digit grouping). */
export function formatMoney(paise: Paise): string {
  return inr.format(paise / 100);
}

/** A balance as ₹88,800.00 Dr or ₹1,00,000.00 Cr. Zero has no suffix. */
export function formatBalance(paise: Paise): string {
  if (paise === 0) return formatMoney(0);
  return `${formatMoney(Math.abs(paise))} ${paise > 0 ? 'Dr' : 'Cr'}`;
}

/** Whole paise as a plain rupee figure, e.g. 7080000 → "70800.00" (for form fields, saving and CSV). */
export function rupeesPlain(paise: Paise): string {
  return (paise / 100).toFixed(2);
}

/** A percentage, or "—" when there is none. */
export function formatPct(pct: number | null): string {
  return pct === null ? '—' : `${pct}%`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** '2026-08-31' as 31-Aug-2026. Works on the text, so it can never shift a day by time zone. */
export function formatDate(date: string | null | undefined): string {
  if (!date) return '';
  const [y, m, d] = date.split('-');
  return `${d}-${MONTHS[Number(m) - 1]}-${y}`;
}
