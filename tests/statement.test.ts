import { describe, expect, it } from 'vitest';
import { addDays } from '@/lib/ar/dates';
import { balanceByDocuments } from '@/lib/ar/positions';
import { statement } from '@/lib/ar/statement';
import type { ArData } from '@/lib/ar/types';
import { sampleData } from './fixture';

const customerId = (code: string) => sampleData.customers.find((c) => c.code === code)!.id;

describe('R15: statement of account', () => {
  it('spot check 8: C002 from 01-Apr-2026 to 31-Aug-2026', () => {
    const s = statement(sampleData, customerId('C002'), '2026-04-01', '2026-08-31');
    expect(s.openingBalance).toBe(7080000);
    expect(s.closingBalance).toBe(22300000);
    expect(s.lines).toHaveLength(7);
    expect(s.lines.map((l) => [l.date, l.kind, l.documentNo, l.debit, l.credit, l.balance])).toEqual([
      ['2026-04-18', 'invoice', 'BWA/26-27/0003', 14160000, 0, 21240000],
      ['2026-05-20', 'receipt', 'RCT/26-27/0005', 0, 6480000, 14760000],
      ['2026-05-20', 'tds', 'RCT/26-27/0005', 0, 600000, 14160000],
      ['2026-05-22', 'invoice', 'BWA/26-27/0009', 9440000, 0, 23600000],
      ['2026-06-15', 'receipt', 'RCT/26-27/0007', 0, 6000000, 17600000],
      ['2026-06-15', 'tds', 'RCT/26-27/0007', 0, 1200000, 16400000],
      ['2026-07-20', 'invoice', 'BWA/26-27/0018', 5900000, 0, 22300000],
    ]);
    expect(s.lines[1].description).toBe('Payment received');
    expect(s.lines[2].description).toBe('TDS deducted by you');
  });

  it('shows a credit note as a credit and leaves out a TDS line when TDS is zero', () => {
    const c004 = statement(sampleData, customerId('C004'), '2026-07-01', '2026-07-31');
    expect(c004.lines.find((l) => l.kind === 'creditNote')).toMatchObject({
      documentNo: 'BWA/CN/26-27/001', credit: 2950000, description: 'Credit note against BWA/26-27/0007',
    });
    const c006 = statement(sampleData, customerId('C006'), '2026-04-01', '2026-08-31');
    expect(c006.lines.filter((l) => l.kind === 'tds')).toHaveLength(0); // C006 deducts no TDS
  });

  it('leaves out cancelled invoices', () => {
    const c007 = statement(sampleData, customerId('C007'), '2026-07-01', '2026-07-31');
    expect(c007.lines.map((l) => l.documentNo)).toEqual(['BWA/26-27/0015']); // 0014 is cancelled
  });

  it('orders same-day lines: invoices, credit notes, receipts, TDS, then document number', () => {
    const c = customerId('C002');
    const inv = sampleData.invoices.find((i) => i.invoiceNo === 'BWA/26-27/0018')!;
    const day = '2026-07-20';
    const data: ArData = {
      ...sampleData,
      invoices: [...sampleData.invoices, { ...inv, id: 9001, invoiceNo: 'BWA/26-27/0099' }],
      creditNotes: [...sampleData.creditNotes, {
        id: 9002, creditNoteNo: 'BWA/CN/26-27/009', invoiceId: inv.id, creditNoteDate: day,
        taxableValue: 100000, cgst: 9000, sgst: 9000, igst: 0, total: 118000, reason: 'test',
      }],
      receipts: [
        { id: 9004, receiptNo: 'RCT/26-27/0098', customerId: c, receiptDate: day, bankAmount: 500, tdsAmount: 50, mode: 'UPI', reference: 'b' },
        { id: 9003, receiptNo: 'RCT/26-27/0097', customerId: c, receiptDate: day, bankAmount: 900, tdsAmount: 100, mode: 'UPI', reference: 'a' },
        ...sampleData.receipts,
      ],
    };
    const s = statement(data, c, day, day);
    expect(s.lines.map((l) => `${l.kind} ${l.documentNo}`)).toEqual([
      'invoice BWA/26-27/0018',
      'invoice BWA/26-27/0099',
      'creditNote BWA/CN/26-27/009',
      'receipt RCT/26-27/0097',
      'receipt RCT/26-27/0098',
      'tds RCT/26-27/0097',
      'tds RCT/26-27/0098',
    ]);
  });

  it('every closing balance equals balanceByDocuments at the To date, for every customer and period', () => {
    const periods: [string, string][] = [
      ['2026-01-01', '2026-03-31'], ['2026-04-01', '2026-08-31'], ['2026-04-01', '2026-10-31'],
      ['2026-07-12', '2026-07-12'], ['2026-08-01', '2026-09-30'], ['2025-01-01', '2026-12-31'],
    ];
    for (const c of sampleData.customers) {
      for (const [from, to] of periods) {
        const s = statement(sampleData, c.id, from, to);
        const label = `${c.code} ${from}..${to}`;
        expect(s.openingBalance, label).toBe(balanceByDocuments(sampleData, c.id, addDays(from, -1)));
        expect(s.closingBalance, label).toBe(balanceByDocuments(sampleData, c.id, to));
        const debits = s.lines.reduce((a, l) => a + l.debit, 0);
        const credits = s.lines.reduce((a, l) => a + l.credit, 0);
        expect(s.openingBalance + debits - credits, label).toBe(s.closingBalance);
        // Footer: ageing buckets less unapplied credit make up the closing balance
        const aged = Object.values(s.ageing).reduce((a, b) => a + b, 0);
        expect(aged - s.unapplied, label).toBe(s.closingBalance);
      }
    }
  });

  it('footer for C005 as at 31-Aug-2026 shows unapplied credit separately', () => {
    const s = statement(sampleData, customerId('C005'), '2026-04-01', '2026-08-31');
    expect(s.closingBalance).toBe(8880000);
    expect(s.unapplied).toBe(10000000);
  });
});
