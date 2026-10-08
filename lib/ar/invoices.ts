// Rules for changing invoices. These look at every record, whatever its date,
// because that is what the database enforces (R6, R7, R8).
import { dueDate } from './dates';
import { creditNoteAmounts, invoiceAmounts, type GstAmounts } from './gst';
import { nextNumber } from './numbering';
import { balanceByDocuments } from './positions';
import type { ArData, Paise } from './types';

export interface InvoiceDraft { customerId: number; invoiceDate: string; taxableValue: Paise; gstRatePct: number }

export interface InvoicePreview extends GstAmounts {
  invoiceNo: string;
  dueDate: string;
  balanceBefore: Paise; // the customer's balance across all records, before this invoice
  balanceAfter: Paise;
  creditLimit: Paise;
  overLimit: boolean; // R9: warn, do not block
}

/** Everything worked out for a new invoice before it is saved: number, due date, GST, total and the credit-limit check. */
export function previewInvoice(data: ArData, draft: InvoiceDraft): InvoicePreview {
  const customer = data.customers.find((c) => c.id === draft.customerId);
  if (!customer) throw new Error(`Unknown customer ${draft.customerId}`);
  const amounts = invoiceAmounts(customer.state, draft.taxableValue, draft.gstRatePct);
  const balanceBefore = balanceByDocuments(data, customer.id, '9999-12-31');
  const balanceAfter = balanceBefore + amounts.total;
  return {
    ...amounts,
    invoiceNo: nextNumber('invoice', data, draft.invoiceDate),
    dueDate: dueDate(draft.invoiceDate, customer.creditDays),
    balanceBefore,
    balanceAfter,
    creditLimit: customer.creditLimit,
    overLimit: balanceAfter > customer.creditLimit,
  };
}

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
    const advice = creditNotes === 0
      ? 'Remove the allocations first, or raise a credit note instead.'
      : 'Credit notes cannot be removed; raise a further credit note for the rest instead.';
    return `${inv.invoiceNo} cannot be cancelled: it has ${parts} against it. ${advice}`;
  }
  return null;
}

export interface CreditNotePreview extends GstAmounts {
  creditNoteNo: string;
  remaining: Paise; // still open on the invoice across all records, before this credit note
  exceedsRemaining: boolean; // R7: allocations + credit notes cannot exceed the invoice total
}

/** R7: a new credit note's number, GST (in the invoice's rate and split) and total, checked against what remains. */
export function previewCreditNote(data: ArData, invoiceId: number, creditNoteDate: string, taxableValue: Paise): CreditNotePreview {
  const invoice = data.invoices.find((i) => i.id === invoiceId);
  if (!invoice) throw new Error(`Unknown invoice ${invoiceId}`);
  const amounts = creditNoteAmounts(invoice, taxableValue);
  const remaining = invoiceRemaining(data, invoiceId);
  return {
    ...amounts,
    creditNoteNo: nextNumber('creditNote', data, creditNoteDate),
    remaining,
    exceedsRemaining: amounts.total > remaining,
  };
}
