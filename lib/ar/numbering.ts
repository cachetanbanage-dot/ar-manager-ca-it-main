// R4: document numbers, per Indian financial year, restarting each 1 April.
import { fyLabel } from './dates';
import type { ArData } from './types';

export type Series = 'invoice' | 'creditNote' | 'receipt';

const FORMATS: Record<Series, { prefix: (fy: string) => string; digits: number }> = {
  invoice: { prefix: (fy) => `BWA/${fy}/`, digits: 4 }, // BWA/26-27/0025
  creditNote: { prefix: (fy) => `BWA/CN/${fy}/`, digits: 3 }, // BWA/CN/26-27/002
  receipt: { prefix: (fy) => `RCT/${fy}/`, digits: 4 }, // RCT/26-27/0018
};

/** Every number already used in a series, cancelled invoices included. */
function usedNumbers(series: Series, data: ArData): string[] {
  if (series === 'invoice') return data.invoices.map((i) => i.invoiceNo);
  if (series === 'creditNote') return data.creditNotes.map((c) => c.creditNoteNo);
  return data.receipts.map((r) => r.receiptNo);
}

/**
 * The next number in a series for a document dated `date`: the highest number
 * already used in that financial year plus one. Numbers are never reused, so
 * cancelled invoices still count.
 */
export function nextNumber(series: Series, data: ArData, date: string): string {
  const { prefix, digits } = FORMATS[series];
  const p = prefix(fyLabel(date));
  let highest = 0;
  for (const no of usedNumbers(series, data)) {
    const rest = no.startsWith(p) ? no.slice(p.length) : '';
    if (/^\d+$/.test(rest)) highest = Math.max(highest, Number(rest));
  }
  return p + String(highest + 1).padStart(digits, '0');
}
