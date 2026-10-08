// The invoice list (Part 2): rows from lib/ar, then filter, search and sort.
import { isValidDate } from '@/lib/asof';
import { invoiceRows, invoiceTotals, type Bucket, type InvoiceRow, type InvoiceStatus, type InvoiceTotals } from '@/lib/ar/positions';
import { DEFAULT_SETTINGS, bucketLabels, type ArSettings } from '@/lib/ar/settings';
import type { ArData, Customer } from '@/lib/ar/types';
import { matchesSearch, sortRows, type SortDir } from '@/lib/sort';

export interface InvoiceListRow extends InvoiceRow { customer: Customer; daysLate: number | null }

export const INVOICE_SORTS = {
  number: (r: InvoiceListRow) => r.invoice.invoiceNo,
  customer: (r: InvoiceListRow) => r.customer.name,
  date: (r: InvoiceListRow) => `${r.invoice.invoiceDate} ${r.invoice.invoiceNo}`,
  due: (r: InvoiceListRow) => `${r.invoice.dueDate} ${r.invoice.invoiceNo}`,
  total: (r: InvoiceListRow) => r.invoice.total,
  received: (r: InvoiceListRow) => r.received,
  credited: (r: InvoiceListRow) => r.credited,
  outstanding: (r: InvoiceListRow) => r.outstanding,
  status: (r: InvoiceListRow) => r.status,
  daysLate: (r: InvoiceListRow) => r.daysLate,
} as const;

export type InvoiceSort = keyof typeof INVOICE_SORTS;
export const STATUS_FILTERS = ['all', 'Paid', 'Due', 'Overdue', 'Cancelled'] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export interface InvoiceListOptions {
  q: string; // part of the invoice number
  customer: number | null;
  status: StatusFilter;
  bucket: Bucket | ''; // R12 ageing bucket, '' for any
  disputed: 'all' | 'yes' | 'no';
  from: string; // invoice date range, 'YYYY-MM-DD' or ''
  to: string;
  sort: InvoiceSort;
  dir: SortDir;
}

export function invoiceListRows(
  data: ArData, asOf: string, o: InvoiceListOptions, settings: ArSettings = DEFAULT_SETTINGS,
): { rows: InvoiceListRow[]; totals: InvoiceTotals } {
  const customers = new Map(data.customers.map((c) => [c.id, c]));
  const rows = invoiceRows(data, asOf, settings)
    .map((r) => ({ ...r, customer: customers.get(r.invoice.customerId)!, daysLate: r.status === 'Overdue' ? r.daysPastDue : null }))
    .filter((r) =>
      (o.customer === null || r.invoice.customerId === o.customer) &&
      (o.status === 'all' || r.status === o.status) &&
      (o.bucket === '' || r.bucket === o.bucket) &&
      (o.disputed === 'all' || r.invoice.isDisputed === (o.disputed === 'yes')) &&
      (o.from === '' || r.invoice.invoiceDate >= o.from) &&
      (o.to === '' || r.invoice.invoiceDate <= o.to) &&
      matchesSearch(o.q, [r.invoice.invoiceNo]));
  const sorted = sortRows(rows, INVOICE_SORTS[o.sort], o.dir);
  return { rows: sorted, totals: invoiceTotals(sorted) };
}

/** Reads list options from the URL, ignoring anything unexpected. */
export function invoiceListOptions(
  params: Record<string, string | string[] | undefined>, settings: ArSettings = DEFAULT_SETTINGS,
): InvoiceListOptions {
  const one = (k: string) => (Array.isArray(params[k]) ? params[k][0] : params[k]) ?? '';
  const status = one('status');
  const disputed = one('disputed');
  const sort = one('sort');
  const date = (k: string) => (isValidDate(one(k)) ? one(k) : '');
  return {
    q: one('q'),
    customer: /^\d+$/.test(one('customer')) ? Number(one('customer')) : null,
    status: (STATUS_FILTERS as readonly string[]).includes(status) ? (status as StatusFilter) : 'all',
    bucket: bucketLabels(settings).includes(one('bucket')) ? (one('bucket') as Bucket) : '',
    disputed: disputed === 'yes' || disputed === 'no' ? disputed : 'all',
    from: date('from'),
    to: date('to'),
    sort: sort in INVOICE_SORTS ? (sort as InvoiceSort) : 'date',
    dir: one('dir') === 'desc' ? 'desc' : 'asc',
  };
}

/** The status filter labels, e.g. for a select box. */
export const STATUS_LABELS: Record<StatusFilter, string> = {
  all: 'All', Paid: 'Paid', Due: 'Due', Overdue: 'Overdue', Cancelled: 'Cancelled',
};
export type { InvoiceStatus };
