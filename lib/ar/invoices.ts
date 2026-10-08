// Rules for changing invoices. These look at every record, whatever its date,
// because that is what the database enforces (R6, R7, R8).
import type { ArData, Paise } from './types';

/**
 * What can still be allocated or credited against an invoice: total − every
 * allocation − every credit note, whatever their dates. Zero for a cancelled invoice.
 */
export function invoiceRemaining(data: ArData, invoiceId: number): Paise {
  const inv = data.invoices.find((i) => i.id === invoiceId);
  if (!inv || inv.isCancelled) return 0;
  let remaining = inv.total;
  for (const a of data.allocations) if (a.invoiceId === invoiceId) remaining -= a.amount;
  for (const c of data.creditNotes) if (c.invoiceId === invoiceId) remaining -= c.total;
  return remaining;
}

/** R8: an invoice can be cancelled only if nothing has ever been allocated or credited against it. */
export function cancelBlocker(data: ArData, invoiceId: number): string | null {
  const inv = data.invoices.find((i) => i.id === invoiceId);
  if (!inv) return 'This invoice does not exist.';
  if (inv.isCancelled) return `${inv.invoiceNo} is already cancelled.`;
  const allocations = data.allocations.filter((a) => a.invoiceId === invoiceId).length;
  const creditNotes = data.creditNotes.filter((c) => c.invoiceId === invoiceId).length;
  if (allocations > 0 || creditNotes > 0) {
    const parts = [
      allocations > 0 ? `${allocations} payment allocation${allocations > 1 ? 's' : ''}` : '',
      creditNotes > 0 ? `${creditNotes} credit note${creditNotes > 1 ? 's' : ''}` : '',
    ].filter(Boolean).join(' and ');
    return `${inv.invoiceNo} cannot be cancelled: it has ${parts} against it. Remove the allocations or raise a credit note instead.`;
  }
  return null;
}
