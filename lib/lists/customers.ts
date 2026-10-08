// The Customer Master list (Part 2): figures from lib/ar, then search, filter and sort.
import { creditUsedPct } from '@/lib/ar/customers';
import { followUpsDue, promiseStatuses, type PromiseStatus } from '@/lib/ar/notes';
import {
  customerPositions, invoiceRows, receiptPositions, type CustomerPosition, type InvoiceRow, type ReceiptPosition,
} from '@/lib/ar/positions';
import { receiptRemaining } from '@/lib/ar/receipts';
import type { ArData, Note, Paise } from '@/lib/ar/types';
import { matchesSearch, sortRows, type SortDir } from '@/lib/sort';

export interface CustomerListRow extends CustomerPosition { usedPct: number | null }

export const CUSTOMER_SORTS = {
  code: (r: CustomerListRow) => r.customer.code,
  name: (r: CustomerListRow) => r.customer.name,
  city: (r: CustomerListRow) => `${r.customer.city}, ${r.customer.state}`,
  contact: (r: CustomerListRow) => r.customer.contactPerson,
  creditDays: (r: CustomerListRow) => r.customer.creditDays,
  creditLimit: (r: CustomerListRow) => r.customer.creditLimit,
  balance: (r: CustomerListRow) => r.netBalance,
  overdue: (r: CustomerListRow) => r.overdue,
  used: (r: CustomerListRow) => r.usedPct,
  status: (r: CustomerListRow) => (r.customer.isActive ? 'Active' : 'Inactive'),
} as const;

export type CustomerSort = keyof typeof CUSTOMER_SORTS;
export type CustomerStatusFilter = 'all' | 'active' | 'inactive';

export interface CustomerListOptions { q?: string; status?: CustomerStatusFilter; sort?: CustomerSort; dir?: SortDir }

export function customerListRows(data: ArData, asOf: string, opts: CustomerListOptions = {}): CustomerListRow[] {
  const { q = '', status = 'all', sort = 'code', dir = 'asc' } = opts;
  const rows = customerPositions(data, asOf)
    .map((p) => ({ ...p, usedPct: creditUsedPct(p.netBalance, p.customer.creditLimit) }))
    .filter((r) => status === 'all' || r.customer.isActive === (status === 'active'))
    .filter((r) => matchesSearch(q, [r.customer.code, r.customer.name, r.customer.contactPerson, r.customer.email]));
  return sortRows(rows, CUSTOMER_SORTS[sort] ?? CUSTOMER_SORTS.code, dir);
}

export interface NoteRow {
  note: Note; invoiceNo: string | null; followUpDue: boolean;
  promiseStatus: PromiseStatus | null; promiseReceived: Paise | null; // R16, as at the date
}

export interface CustomerDetail {
  position: CustomerListRow;
  invoices: InvoiceRow[]; // oldest first
  receipts: (ReceiptPosition & { openAllTime: Paise; hasAllocations: boolean })[]; // oldest first; openAllTime = credit left across all records
  notes: NoteRow[]; // newest first
}

/** Everything the customer page shows, as at asOf. Null if there is no such customer. */
export function customerDetail(data: ArData, customerId: number, asOf: string): CustomerDetail | null {
  const pos = customerPositions(data, asOf).find((p) => p.customer.id === customerId);
  if (!pos) return null;
  const invoiceNo = new Map(data.invoices.map((i) => [i.id, i.invoiceNo]));
  const promises = new Map(promiseStatuses(data, asOf).map((p) => [p.note.id, p]));
  const due = new Set(followUpsDue(data, asOf).map((f) => f.note.id));

  return {
    position: { ...pos, usedPct: creditUsedPct(pos.netBalance, pos.customer.creditLimit) },
    invoices: sortRows(
      invoiceRows(data, asOf).filter((r) => r.invoice.customerId === customerId),
      (r) => `${r.invoice.invoiceDate} ${r.invoice.invoiceNo}`, 'asc'),
    receipts: sortRows(
      receiptPositions(data, asOf).filter((r) => r.receipt.customerId === customerId),
      (r) => `${r.receipt.receiptDate} ${r.receipt.receiptNo}`, 'asc')
      .map((r) => ({
        ...r,
        openAllTime: receiptRemaining(data, r.receipt.id),
        hasAllocations: data.allocations.some((a) => a.receiptId === r.receipt.id),
      })),
    notes: sortRows(
      data.notes.filter((n) => n.customerId === customerId && n.noteDate <= asOf),
      (n) => `${n.noteDate} ${String(n.id).padStart(10, '0')}`, 'desc')
      .map((note) => ({
        note,
        invoiceNo: note.invoiceId === null ? null : invoiceNo.get(note.invoiceId) ?? null,
        followUpDue: due.has(note.id),
        promiseStatus: promises.get(note.id)?.status ?? null,
        promiseReceived: promises.get(note.id)?.received ?? null,
      })),
  };
}

/** Reads list options from the URL, ignoring anything unexpected. */
export function customerListOptions(params: Record<string, string | string[] | undefined>): Required<CustomerListOptions> {
  const one = (k: string) => (Array.isArray(params[k]) ? params[k][0] : params[k]) ?? '';
  const sort = one('sort');
  const status = one('status');
  return {
    q: one('q'),
    status: status === 'active' || status === 'inactive' ? status : 'all',
    sort: sort in CUSTOMER_SORTS ? (sort as CustomerSort) : 'code',
    dir: one('dir') === 'desc' ? 'desc' : 'asc',
  };
}
