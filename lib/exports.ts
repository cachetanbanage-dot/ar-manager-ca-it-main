// The rows of each CSV export. Figures come from lib/ar; this only lays them out.
import type { AgeingTotals } from '@/lib/ar/dashboard';
import { BUCKETS, type CustomerPosition, type InvoiceTotals } from '@/lib/ar/positions';
import type { Statement } from '@/lib/ar/statement';
import type { Paise } from '@/lib/ar/types';
import { formatDate, rupeesPlain } from '@/lib/format';
import type { InvoiceListRow } from '@/lib/lists/invoices';

const drCr = (p: Paise) => (p > 0 ? 'Dr' : p < 0 ? 'Cr' : '');
const abs = (p: Paise) => rupeesPlain(Math.abs(p));

/** R15: the statement of account as CSV rows. */
export function statementRows(s: Statement): string[][] {
  const rows: string[][] = [
    ['Date', 'Document', 'Description', 'Debit', 'Credit', 'Balance', 'Dr/Cr'],
    [formatDate(s.from), '', 'Opening balance', '', '', abs(s.openingBalance), drCr(s.openingBalance)],
  ];
  for (const l of s.lines) {
    rows.push([formatDate(l.date), l.documentNo, l.description,
      l.debit ? rupeesPlain(l.debit) : '', l.credit ? rupeesPlain(l.credit) : '', abs(l.balance), drCr(l.balance)]);
  }
  rows.push([formatDate(s.to), '', 'Closing balance', '', '', abs(s.closingBalance), drCr(s.closingBalance)]);
  rows.push([]);
  rows.push(['Ageing of the closing balance', '', '', '', '', 'Amount', '']);
  for (const b of BUCKETS) rows.push([b, '', '', '', '', rupeesPlain(s.ageing[b]), '']);
  rows.push(['Unapplied credit', '', '', '', '', rupeesPlain(s.unapplied), s.unapplied > 0 ? 'Cr' : '']);
  return rows;
}

/** The filtered invoice list as CSV rows, with its totals row. */
export function invoiceListRowsCsv(rows: InvoiceListRow[], totals: InvoiceTotals): string[][] {
  return [
    ['Number', 'Customer code', 'Customer', 'Invoice date', 'Due date', 'Total', 'Received', 'Credited', 'Outstanding', 'Status', 'Part-paid', 'Disputed', 'Days late'],
    ...rows.map((r) => [
      r.invoice.invoiceNo, r.customer.code, r.customer.name, formatDate(r.invoice.invoiceDate), formatDate(r.invoice.dueDate),
      rupeesPlain(r.invoice.total), rupeesPlain(r.received), rupeesPlain(r.credited), rupeesPlain(r.outstanding),
      r.status, r.isPartPaid ? 'Yes' : '', r.invoice.isDisputed ? 'Yes' : '', r.daysLate === null ? '' : String(r.daysLate),
    ]),
    ['Total (excluding cancelled)', '', '', '', '', rupeesPlain(totals.total), rupeesPlain(totals.received),
      rupeesPlain(totals.credited), rupeesPlain(totals.outstanding), '', '', '', ''],
  ];
}

/** R12 + R13: ageing by customer as CSV rows, unapplied credit in its own column, with a totals row. */
export function ageingRowsCsv(ageing: CustomerPosition[], totals: AgeingTotals): string[][] {
  return [
    ['Code', 'Customer', ...BUCKETS, 'Outstanding', 'Unapplied credit', 'Net balance', 'Dr/Cr'],
    ...ageing.map((p) => [
      p.customer.code, p.customer.name, ...BUCKETS.map((b) => rupeesPlain(p.buckets[b])),
      rupeesPlain(p.outstanding), rupeesPlain(p.unapplied), abs(p.netBalance), drCr(p.netBalance),
    ]),
    ['Total', '', ...BUCKETS.map((b) => rupeesPlain(totals.buckets[b])),
      rupeesPlain(totals.outstanding), rupeesPlain(totals.unapplied), abs(totals.netBalance), drCr(totals.netBalance)],
  ];
}
