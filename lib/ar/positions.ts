// R10 to R14: positions of invoices, receipts and customers as at a date.
import { daysBetween } from './dates';
import { DEFAULT_SETTINGS, bucketForDays, bucketLabels, type ArSettings } from './settings';
import type { ArData, Customer, Invoice, Paise, Receipt } from './types';

export { daysBetween };

/** An ageing bucket's name, e.g. 'Not due', '1-30', 'Over 180'. The buckets come from the settings. */
export type Bucket = string;
/** The brief's buckets (R12), used whenever no other settings are given. */
export const BUCKETS: Bucket[] = bucketLabels(DEFAULT_SETTINGS);

export interface InvoicePosition {
  invoice: Invoice;
  received: Paise;
  credited: Paise;
  outstanding: Paise;
  daysPastDue: number;
  status: 'Paid' | 'Due' | 'Overdue';
  isPartPaid: boolean;
  bucket: Bucket | null;
}

/**
 * R12: ageing bucket from days past due (from the due date, not the invoice date).
 * With the brief's buckets: 0 or fewer Not due, 1-30, 31-60, 61-90, 91-180, Over 180.
 */
export function bucketFor(daysPastDue: number, settings: ArSettings = DEFAULT_SETTINGS): Bucket {
  return bucketForDays(daysPastDue, settings);
}

/** R11 + R12: the position of every live invoice at the end of asOf ('YYYY-MM-DD'). */
export function invoicePositions(data: ArData, asOf: string, settings: ArSettings = DEFAULT_SETTINGS): InvoicePosition[] {
  const received = new Map<number, Paise>();
  for (const a of data.allocations) {
    if (a.allocationDate <= asOf) received.set(a.invoiceId, (received.get(a.invoiceId) ?? 0) + a.amount);
  }
  const credited = new Map<number, Paise>();
  for (const c of data.creditNotes) {
    if (c.creditNoteDate <= asOf) credited.set(c.invoiceId, (credited.get(c.invoiceId) ?? 0) + c.total);
  }
  return data.invoices
    .filter((i) => !i.isCancelled && i.invoiceDate <= asOf)
    .map((i) => {
      const rec = received.get(i.id) ?? 0;
      const cred = credited.get(i.id) ?? 0;
      const outstanding = i.total - rec - cred;
      const daysPastDue = daysBetween(i.dueDate, asOf);
      return {
        invoice: i,
        received: rec,
        credited: cred,
        outstanding,
        daysPastDue,
        status: outstanding === 0 ? 'Paid' : daysPastDue >= 1 ? 'Overdue' : 'Due',
        isPartPaid: outstanding > 0 && rec + cred > 0,
        bucket: outstanding === 0 ? null : bucketFor(daysPastDue, settings),
      };
    });
}

export type InvoiceStatus = InvoicePosition['status'] | 'Cancelled';
export interface InvoiceRow extends Omit<InvoicePosition, 'status'> { status: InvoiceStatus }

/**
 * R8 + R11: every invoice dated on or before asOf, for listing. Live invoices
 * carry their position; cancelled ones keep their number and show the status
 * Cancelled with nothing received, credited or outstanding.
 */
export function invoiceRows(data: ArData, asOf: string, settings: ArSettings = DEFAULT_SETTINGS): InvoiceRow[] {
  const cancelled: InvoiceRow[] = data.invoices
    .filter((i) => i.isCancelled && i.invoiceDate <= asOf)
    .map((i) => ({
      invoice: i, received: 0, credited: 0, outstanding: 0,
      daysPastDue: daysBetween(i.dueDate, asOf), status: 'Cancelled', isPartPaid: false, bucket: null,
    }));
  return [...invoicePositions(data, asOf, settings), ...cancelled];
}

export interface InvoiceTotals { total: Paise; received: Paise; credited: Paise; outstanding: Paise }

/** Totals of a list of invoice rows. Cancelled invoices are left out of every total (R8). */
export function invoiceTotals(rows: InvoiceRow[]): InvoiceTotals {
  const t = { total: 0, received: 0, credited: 0, outstanding: 0 };
  for (const r of rows) {
    if (r.status === 'Cancelled') continue;
    t.total += r.invoice.total;
    t.received += r.received;
    t.credited += r.credited;
    t.outstanding += r.outstanding;
  }
  return t;
}

export interface ReceiptPosition {
  receipt: Receipt;
  settlement: Paise; // R5: bank + TDS
  allocated: Paise;
  unapplied: Paise;
}

/** R5 + R13: every receipt dated on or before asOf, with what has been allocated from it by asOf. */
export function receiptPositions(data: ArData, asOf: string): ReceiptPosition[] {
  const allocated = new Map<number, Paise>();
  for (const a of data.allocations) {
    if (a.allocationDate <= asOf) allocated.set(a.receiptId, (allocated.get(a.receiptId) ?? 0) + a.amount);
  }
  return data.receipts
    .filter((r) => r.receiptDate <= asOf)
    .map((r) => {
      const settlement = r.bankAmount + r.tdsAmount;
      const alloc = allocated.get(r.id) ?? 0;
      return { receipt: r, settlement, allocated: alloc, unapplied: settlement - alloc };
    });
}

export interface CustomerPosition {
  customer: Customer;
  buckets: Record<Bucket, Paise>;
  outstanding: Paise; // Σ invoice outstanding, before unapplied credit
  unapplied: Paise; // shown in its own column, never netted against a bucket
  netBalance: Paise; // positive = Dr (customer owes us), negative = Cr
  overdue: Paise; // outstanding minus the Not due bucket
  overLimit: boolean;
}

/** A row of zeros, one per bucket: each customer starts here before its invoices are added. */
export const emptyBuckets = (settings: ArSettings = DEFAULT_SETTINGS): Record<Bucket, Paise> =>
  Object.fromEntries(bucketLabels(settings).map((b) => [b, 0]));

/**
 * R13: one entry per customer, adding up its invoice and receipt positions.
 * Overdue does not depend on the bucket settings: "Not due" is always 0 days or fewer.
 */
export function customerPositions(data: ArData, asOf: string, settings: ArSettings = DEFAULT_SETTINGS): CustomerPosition[] {
  const byCustomer = new Map<number, CustomerPosition>();
  for (const c of data.customers) {
    byCustomer.set(c.id, {
      customer: c, buckets: emptyBuckets(settings), outstanding: 0, unapplied: 0, netBalance: 0, overdue: 0, overLimit: false,
    });
  }
  for (const p of invoicePositions(data, asOf, settings)) {
    const pos = byCustomer.get(p.invoice.customerId)!;
    pos.outstanding += p.outstanding;
    if (p.bucket) pos.buckets[p.bucket] += p.outstanding;
  }
  for (const r of receiptPositions(data, asOf)) {
    byCustomer.get(r.receipt.customerId)!.unapplied += r.unapplied;
  }
  for (const pos of byCustomer.values()) {
    pos.netBalance = pos.outstanding - pos.unapplied;
    pos.overdue = pos.outstanding - pos.buckets['Not due'];
    pos.overLimit = pos.netBalance > pos.customer.creditLimit;
  }
  return [...byCustomer.values()];
}

/**
 * R14: a customer's balance straight from the documents —
 * invoices − credit notes − receipt settlement values, all dated ≤ asOf.
 */
export function balanceByDocuments(data: ArData, customerId: number, asOf: string): Paise {
  const invoices = data.invoices.filter((i) => i.customerId === customerId && !i.isCancelled);
  const invoiceIds = new Set(invoices.map((i) => i.id));
  let balance = 0;
  for (const i of invoices) if (i.invoiceDate <= asOf) balance += i.total;
  for (const c of data.creditNotes) if (invoiceIds.has(c.invoiceId) && c.creditNoteDate <= asOf) balance -= c.total;
  for (const r of data.receipts) {
    if (r.customerId === customerId && r.receiptDate <= asOf) balance -= r.bankAmount + r.tdsAmount;
  }
  return balance;
}

export interface BalanceDifference { customer: Customer; netBalance: Paise; byDocuments: Paise }

/**
 * R14, the control check: like reconciling the debtors control account to the
 * personal ledgers. Returns only the customers whose two balances differ —
 * it must always return an empty list.
 */
export function balanceCheck(data: ArData, asOf: string): BalanceDifference[] {
  return customerPositions(data, asOf)
    .map((p) => ({ customer: p.customer, netBalance: p.netBalance, byDocuments: balanceByDocuments(data, p.customer.id, asOf) }))
    .filter((d) => d.netBalance !== d.byDocuments);
}
