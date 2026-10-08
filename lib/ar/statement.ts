// R15: statement of account for one customer, from `from` to `to` (both included).
import { addDays } from './dates';
import { balanceByDocuments, customerPositions, type Bucket } from './positions';
import { DEFAULT_SETTINGS, type ArSettings } from './settings';
import type { ArData, Customer, Paise } from './types';

export type StatementLineKind = 'invoice' | 'creditNote' | 'receipt' | 'tds';

export interface StatementLine {
  date: string;
  kind: StatementLineKind;
  documentNo: string;
  description: string;
  debit: Paise;
  credit: Paise;
  balance: Paise; // running balance after this line; positive = Dr
}

export interface Statement {
  customer: Customer;
  from: string;
  to: string;
  openingBalance: Paise; // the R14 balance as at the day before `from`
  lines: StatementLine[];
  closingBalance: Paise; // equals the R14 balance as at `to`
  ageing: Record<Bucket, Paise>; // footer: what makes up the closing balance
  unapplied: Paise;
}

// Lines on the same date: invoices, then credit notes, then receipts, then TDS lines
const KIND_ORDER: Record<StatementLineKind, number> = { invoice: 0, creditNote: 1, receipt: 2, tds: 3 };

export function statement(
  data: ArData, customerId: number, from: string, to: string, settings: ArSettings = DEFAULT_SETTINGS,
): Statement {
  const customer = data.customers.find((c) => c.id === customerId);
  if (!customer) throw new Error(`Unknown customer ${customerId}`);
  const inPeriod = (date: string) => date >= from && date <= to;

  // Cancelled invoices, allocations and notes are left out
  const invoices = data.invoices.filter((i) => i.customerId === customerId && !i.isCancelled);
  const invoiceNoById = new Map(invoices.map((i) => [i.id, i.invoiceNo]));

  const lines: Omit<StatementLine, 'balance'>[] = [];
  for (const i of invoices) {
    if (inPeriod(i.invoiceDate)) {
      lines.push({ date: i.invoiceDate, kind: 'invoice', documentNo: i.invoiceNo, description: i.description, debit: i.total, credit: 0 });
    }
  }
  for (const c of data.creditNotes) {
    if (invoiceNoById.has(c.invoiceId) && inPeriod(c.creditNoteDate)) {
      lines.push({
        date: c.creditNoteDate, kind: 'creditNote', documentNo: c.creditNoteNo,
        description: `Credit note against ${invoiceNoById.get(c.invoiceId)}`, debit: 0, credit: c.total,
      });
    }
  }
  for (const r of data.receipts) {
    if (r.customerId !== customerId || !inPeriod(r.receiptDate)) continue;
    lines.push({ date: r.receiptDate, kind: 'receipt', documentNo: r.receiptNo, description: 'Payment received', debit: 0, credit: r.bankAmount });
    if (r.tdsAmount > 0) {
      lines.push({ date: r.receiptDate, kind: 'tds', documentNo: r.receiptNo, description: 'TDS deducted by you', debit: 0, credit: r.tdsAmount });
    }
  }

  const compare = (x: string, y: string) => (x < y ? -1 : x > y ? 1 : 0);
  lines.sort((a, b) =>
    compare(a.date, b.date) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || compare(a.documentNo, b.documentNo));

  const openingBalance = balanceByDocuments(data, customerId, addDays(from, -1));
  let balance = openingBalance;
  const withBalance = lines.map((l) => {
    balance += l.debit - l.credit;
    return { ...l, balance };
  });

  const position = customerPositions(data, to, settings).find((p) => p.customer.id === customerId)!;
  return {
    customer, from, to, openingBalance, lines: withBalance, closingBalance: balance,
    ageing: position.buckets, unapplied: position.unapplied,
  };
}
