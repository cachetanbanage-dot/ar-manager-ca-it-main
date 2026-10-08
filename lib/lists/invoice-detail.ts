// Everything the invoice page shows (Part 2), as at a date.
import { cancelBlocker, invoiceRemaining } from '@/lib/ar/invoices';
import { invoiceRows, type InvoiceRow } from '@/lib/ar/positions';
import type { Allocation, ArData, CreditNote, Customer, Invoice, Note, Paise, Receipt } from '@/lib/ar/types';
import { DEFAULT_SETTINGS, type ArSettings } from '@/lib/ar/settings';
import { sortRows } from '@/lib/sort';

export interface InvoiceDetail {
  invoice: Invoice;
  row: InvoiceRow | null; // null when the invoice is dated after the as-at date
  customer: Customer;
  allocations: { allocation: Allocation; receipt: Receipt }[]; // dated ≤ asOf
  creditNotes: (CreditNote & { gst: Paise })[]; // dated ≤ asOf; gst = CGST + SGST + IGST
  notes: Note[]; // dated ≤ asOf, newest first
  laterRecords: number; // allocations and credit notes dated after asOf (not counted in the position)
  remaining: Paise; // across all records: what can still be allocated or credited
  cancelBlocker: string | null; // why it cannot be cancelled, or null if it can
}

export function invoiceDetail(
  data: ArData, invoiceId: number, asOf: string, settings: ArSettings = DEFAULT_SETTINGS,
): InvoiceDetail | null {
  const invoice = data.invoices.find((i) => i.id === invoiceId);
  if (!invoice) return null;
  const receipts = new Map(data.receipts.map((r) => [r.id, r]));
  const allocs = data.allocations.filter((a) => a.invoiceId === invoiceId);
  const cns = data.creditNotes.filter((c) => c.invoiceId === invoiceId);

  return {
    invoice,
    row: invoiceRows(data, asOf, settings).find((r) => r.invoice.id === invoiceId) ?? null,
    customer: data.customers.find((c) => c.id === invoice.customerId)!,
    allocations: sortRows(allocs.filter((a) => a.allocationDate <= asOf), (a) => `${a.allocationDate} ${a.id}`, 'asc')
      .map((allocation) => ({ allocation, receipt: receipts.get(allocation.receiptId)! })),
    creditNotes: sortRows(cns.filter((c) => c.creditNoteDate <= asOf), (c) => `${c.creditNoteDate} ${c.creditNoteNo}`, 'asc')
      .map((c) => ({ ...c, gst: c.cgst + c.sgst + c.igst })),
    notes: sortRows(data.notes.filter((n) => n.invoiceId === invoiceId && n.noteDate <= asOf), (n) => `${n.noteDate} ${n.id}`, 'desc'),
    laterRecords: allocs.filter((a) => a.allocationDate > asOf).length + cns.filter((c) => c.creditNoteDate > asOf).length,
    remaining: invoiceRemaining(data, invoiceId),
    cancelBlocker: cancelBlocker(data, invoiceId),
  };
}
