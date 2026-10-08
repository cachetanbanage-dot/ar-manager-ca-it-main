import { describe, expect, it } from 'vitest';
import { invoiceRows, invoiceTotals } from '@/lib/ar/positions';
import { invoiceListOptions, invoiceListRows } from '@/lib/lists/invoices';
import { sampleData } from './fixture';

const opts = (o: Record<string, string> = {}) => invoiceListOptions(o);
const list = (o: Record<string, string> = {}, asOf = '2026-08-31') => invoiceListRows(sampleData, asOf, opts(o));
const nos = (o: Record<string, string> = {}, asOf?: string) => list(o, asOf).rows.map((r) => r.invoice.invoiceNo.slice(-4));

describe('invoiceTotals', () => {
  it('adds up the rows but leaves out cancelled invoices (R8)', () => {
    const t = invoiceTotals(invoiceRows(sampleData, '2026-08-31'));
    expect(t.outstanding).toBe(211810000); // the same total as the DSO test
    expect(t.total - t.received - t.credited).toBe(t.outstanding);
  });
});

describe('invoice list', () => {
  it('shows every invoice dated on or before the as-at date, oldest first', () => {
    expect(list().rows).toHaveLength(28);
    expect(nos().slice(0, 3)).toEqual(['0141', '0156', '0162']);
  });

  it('filters by status, including Cancelled', () => {
    expect(nos({ status: 'Cancelled' })).toEqual(['0014']);
    // 0018 (C002, 45 days) is due 03-Sep and 0019 (C004, 60 days) 28-Sep
    expect(nos({ status: 'Due' })).toEqual(['0018', '0019', '0021', '0022', '0023']);
    expect(list({ status: 'Overdue' }).rows.every((r) => r.status === 'Overdue' && r.daysLate! >= 1)).toBe(true);
  });

  it('filters by customer, disputed flag and date range, and searches by number', () => {
    const c002 = String(sampleData.customers.find((c) => c.code === 'C002')!.id);
    expect(nos({ customer: c002 })).toEqual(['0162', '0003', '0009', '0018']);
    expect(nos({ disputed: 'yes' })).toEqual(['0010']);
    expect(nos({ from: '2026-08-01', to: '2026-08-20' })).toEqual(['0020', '0021', '0022']);
    expect(nos({ q: '25-26' })).toHaveLength(5);
    expect(nos({ q: '0007' })).toEqual(['0007']);
  });

  it('filters by ageing bucket, for the click-through from the ageing table', () => {
    const c003 = String(sampleData.customers.find((c) => c.code === 'C003')!.id);
    expect(nos({ bucket: 'Over 180' })).toEqual(['0141']);
    expect(nos({ customer: c003, bucket: '91-180' })).toEqual(['0156', '0004']);
    expect(opts({ bucket: 'nonsense' }).bucket).toBe('');
  });

  it('totals the filtered rows', () => {
    const { totals } = list({ status: 'Due' });
    expect(totals.outstanding).toBe(5900000 + 35400000 + 8850000 + 7080000 + 25960000); // 0018, 0019, 0021, 0022, 0023
    expect(list({ status: 'Cancelled' }).totals).toEqual({ total: 0, received: 0, credited: 0, outstanding: 0 });
  });

  it('sorts by days late, longest first, with non-overdue invoices last', () => {
    const rows = list({ sort: 'daysLate', dir: 'desc' }).rows;
    expect(rows[0].invoice.invoiceNo).toBe('BWA/25-26/0141'); // due 19-Feb, 193 days late on 31-Aug
    expect(rows[0].daysLate).toBe(193);
    expect(rows.at(-1)!.daysLate).toBeNull();
  });

  it('reads options from the URL and ignores anything unexpected', () => {
    expect(opts({ status: 'Overdue', disputed: 'yes', customer: '12', from: '2026-04-01', to: 'junk', sort: 'total', dir: 'desc' }))
      .toEqual({ q: '', customer: 12, status: 'Overdue', bucket: '', disputed: 'yes', from: '2026-04-01', to: '', sort: 'total', dir: 'desc' });
    expect(opts({ status: 'deleted', customer: 'x', sort: 'nope' }))
      .toMatchObject({ status: 'all', customer: null, sort: 'date', dir: 'asc' });
  });
});
