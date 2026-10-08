import { describe, expect, it } from 'vitest';
import { paise } from '@/lib/ar/rows';
import { sampleData } from './fixture';

describe('paise', () => {
  it('converts rupees to whole paise', () => {
    expect(paise(88500)).toBe(8850000);
    expect(paise('69600.00')).toBe(6960000);
    expect(paise(0.29)).toBe(29); // 0.29 * 100 is 28.999999999999996 in JavaScript
  });
});

describe('sample data fixture', () => {
  it('has every record from the brief (Part 3.5)', () => {
    expect(sampleData.customers).toHaveLength(8);
    expect(sampleData.invoices).toHaveLength(29);
    expect(sampleData.creditNotes).toHaveLength(1);
    expect(sampleData.receipts).toHaveLength(17);
    expect(sampleData.allocations).toHaveLength(18);
    expect(sampleData.notes).toHaveLength(7);
  });

  it('converts an invoice to paise with camelCase names (spot check 1)', () => {
    const inv = sampleData.invoices.find((i) => i.invoiceNo === 'BWA/26-27/0001')!;
    expect(inv).toMatchObject({
      invoiceDate: '2026-04-05', dueDate: '2026-05-05',
      taxableValue: 7500000, cgst: 675000, sgst: 675000, igst: 0, total: 8850000,
      isCancelled: false, isDisputed: false,
    });
  });

  it('converts receipts, credit notes, customers and notes', () => {
    const rct = sampleData.receipts.find((r) => r.receiptNo === 'RCT/26-27/0013')!;
    expect(rct).toMatchObject({ bankAmount: 24000000, tdsAmount: 2250000, mode: 'RTGS' });

    expect(sampleData.creditNotes[0]).toMatchObject({ creditNoteNo: 'BWA/CN/26-27/001', total: 2950000 });

    const c008 = sampleData.customers.find((c) => c.code === 'C008')!;
    expect(c008).toMatchObject({ creditLimit: 20000000, tdsRatePct: 10, isActive: false });

    const promise = sampleData.notes.find((n) => n.noteDate === '2026-07-20')!;
    expect(promise).toMatchObject({ promiseDate: '2026-08-01', promiseAmount: 6960000, followUpDate: null });
  });

  it('keeps the cancelled and disputed flags', () => {
    const byNo = (no: string) => sampleData.invoices.find((i) => i.invoiceNo === no)!;
    expect(byNo('BWA/26-27/0014').isCancelled).toBe(true);
    expect(byNo('BWA/26-27/0010').isDisputed).toBe(true);
  });
});
