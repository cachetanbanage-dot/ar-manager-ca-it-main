// R17: days sales outstanding, as at a date.
import { addDays } from './dates';
import { invoicePositions } from './positions';
import { DEFAULT_SETTINGS } from './settings';
import type { ArData } from './types';

/**
 * R17: DSO = Σ invoice outstanding (before unapplied credit) ÷ S × N,
 * rounded to the nearest whole day, where S is the last N days' sales
 * (D−(N−1) to D, both included): non-cancelled invoice totals less credit-note
 * totals. N is 90 in the brief and can be changed in Settings.
 * Returns null when S is zero (the screen shows "—"), or negative.
 */
export function dso(data: ArData, asOf: string, days: number = DEFAULT_SETTINGS.dsoDays): number | null {
  const windowStart = addDays(asOf, -(days - 1));
  const inWindow = (date: string) => date >= windowStart && date <= asOf;

  let sales = 0;
  for (const i of data.invoices) if (!i.isCancelled && inWindow(i.invoiceDate)) sales += i.total;
  for (const c of data.creditNotes) if (inWindow(c.creditNoteDate)) sales -= c.total;
  if (sales <= 0) return null;

  const outstanding = invoicePositions(data, asOf).reduce((sum, p) => sum + p.outstanding, 0);
  return Math.round((outstanding * days) / sales);
}
