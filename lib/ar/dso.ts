// R17: days sales outstanding, as at a date.
import { addDays } from './dates';
import { invoicePositions } from './positions';
import type { ArData } from './types';

/**
 * R17: DSO = Σ invoice outstanding (before unapplied credit) ÷ S × 90,
 * rounded to the nearest whole day, where S is the 90 days' sales
 * (D−89 to D): non-cancelled invoice totals less credit-note totals.
 * Returns null when S is zero (the screen shows "—"), or negative.
 */
export function dso(data: ArData, asOf: string): number | null {
  const windowStart = addDays(asOf, -89);
  const inWindow = (date: string) => date >= windowStart && date <= asOf;

  let sales = 0;
  for (const i of data.invoices) if (!i.isCancelled && inWindow(i.invoiceDate)) sales += i.total;
  for (const c of data.creditNotes) if (inWindow(c.creditNoteDate)) sales -= c.total;
  if (sales <= 0) return null;

  const outstanding = invoicePositions(data, asOf).reduce((sum, p) => sum + p.outstanding, 0);
  return Math.round((outstanding * 90) / sales);
}
