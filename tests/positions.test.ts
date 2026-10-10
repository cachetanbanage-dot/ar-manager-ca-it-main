import { describe, expect, it } from 'vitest';
import { addDays } from '@/lib/ar/dates';
import {
  balanceByDocuments, balanceCheck, bucketFor, customerPositions, invoicePositions, receiptPositions,
} from '@/lib/ar/positions';
import { sampleData } from './fixture';

const invoiceAt = (no: string, asOf: string) =>
  invoicePositions(sampleData, asOf).find((p) => p.invoice.invoiceNo === no);
const customerAt = (code: string, asOf: string) =>
  customerPositions(sampleData, asOf).find((p) => p.customer.code === code)!;

describe('R12: ageing buckets', () => {
  it('puts each boundary day in the right bucket', () => {
    expect(bucketFor(-5)).toBe('Not due');
    expect(bucketFor(0)).toBe('Not due');
    expect(bucketFor(1)).toBe('1-15');
    expect(bucketFor(15)).toBe('1-15');
    expect(bucketFor(16)).toBe('16-30');
    expect(bucketFor(30)).toBe('16-30');
    expect(bucketFor(31)).toBe('31-45');
    expect(bucketFor(45)).toBe('31-45');
    expect(bucketFor(46)).toBe('46-90');
    expect(bucketFor(90)).toBe('46-90');
    expect(bucketFor(91)).toBe('Over 90');
    expect(bucketFor(400)).toBe('Over 90');
  });
});

describe('R11: invoice positions', () => {
  it('spot check 3: BWA/26-27/0003 as at 31-Aug-2026', () => {
    expect(invoiceAt('BWA/26-27/0003', '2026-08-31')).toMatchObject({
      outstanding: 6960000, status: 'Overdue', isPartPaid: true, daysPastDue: 90, bucket: '46-90',
    });
  });

  it('spot check 4: BWA/26-27/0021 is Due on 31-Aug, Overdue 2 days on 06-Sep, Paid on 15-Sep', () => {
    expect(invoiceAt('BWA/26-27/0021', '2026-08-31')).toMatchObject({ status: 'Due', outstanding: 8850000 });
    expect(invoiceAt('BWA/26-27/0021', '2026-09-06')).toMatchObject({ status: 'Overdue', daysPastDue: 2, outstanding: 8850000 });
    expect(invoiceAt('BWA/26-27/0021', '2026-09-15')).toMatchObject({ status: 'Paid', outstanding: 0, bucket: null });
  });

  it('is still Due on its due date (04-Sep for 0021)', () => {
    expect(invoiceAt('BWA/26-27/0021', '2026-09-04')).toMatchObject({ status: 'Due', daysPastDue: 0, bucket: 'Not due' });
    expect(invoiceAt('BWA/26-27/0021', '2026-09-05')).toMatchObject({ status: 'Overdue', daysPastDue: 1, bucket: '1-15' });
  });

  it('spot check 7: BWA/26-27/0007 as at 31-Aug-2026', () => {
    expect(invoiceAt('BWA/26-27/0007', '2026-08-31')).toMatchObject({
      outstanding: 300000, credited: 2950000, received: 26250000, isPartPaid: true,
    });
  });

  it('uses the allocation date, not the receipt date (0017 not part-paid on 31-Aug)', () => {
    expect(invoiceAt('BWA/26-27/0017', '2026-08-31')).toMatchObject({ received: 0, outstanding: 11800000, isPartPaid: false });
    // On 05-Sep the 1,00,000.00 advance is allocated against the 1,18,000.00 invoice
    expect(invoiceAt('BWA/26-27/0017', '2026-09-05')).toMatchObject({ received: 10000000, outstanding: 1800000, isPartPaid: true });
  });

  it('leaves out cancelled invoices and invoices dated after the as-at date', () => {
    expect(invoiceAt('BWA/26-27/0014', '2026-08-31')).toBeUndefined(); // cancelled
    expect(invoiceAt('BWA/26-27/0024', '2026-09-04')).toBeUndefined(); // dated 05-Sep
    expect(invoiceAt('BWA/26-27/0024', '2026-09-05')).toBeDefined();
  });

  it('shows the disputed flag without changing any amount', () => {
    expect(invoiceAt('BWA/26-27/0010', '2026-08-31')).toMatchObject({ outstanding: 4720000 });
    expect(invoiceAt('BWA/26-27/0010', '2026-08-31')!.invoice.isDisputed).toBe(true);
  });
});

describe('R5: receipt positions', () => {
  it('settlement = bank + TDS; unapplied = settlement − allocations to date', () => {
    const rct11 = (asOf: string) => receiptPositions(sampleData, asOf).find((r) => r.receipt.receiptNo === 'RCT/26-27/0011');
    expect(rct11('2026-07-09')).toBeUndefined();
    expect(rct11('2026-08-31')).toMatchObject({ settlement: 10000000, allocated: 0, unapplied: 10000000 });
    expect(rct11('2026-09-05')).toMatchObject({ settlement: 10000000, allocated: 10000000, unapplied: 0 });
  });
});

describe('R13: customer positions', () => {
  it('spot check 5: C005 as at 31-Aug-2026', () => {
    expect(customerAt('C005', '2026-08-31')).toMatchObject({ outstanding: 18880000, unapplied: 10000000, netBalance: 8880000 });
  });

  it('spot check 6: C005 as at 12-Jul-2026 is 1,00,000.00 Cr', () => {
    expect(customerAt('C005', '2026-07-12')).toMatchObject({ outstanding: 0, unapplied: 10000000, netBalance: -10000000 });
  });

  it('buckets add up to outstanding, and overdue = outstanding − Not due', () => {
    for (const asOf of ['2026-06-30', '2026-08-31', '2026-10-31']) {
      for (const p of customerPositions(sampleData, asOf)) {
        const sum = Object.values(p.buckets).reduce((a, b) => a + b, 0);
        expect(sum).toBe(p.outstanding);
        expect(p.overdue).toBe(p.outstanding - p.buckets['Not due']);
        expect(p.overLimit).toBe(p.netBalance > p.customer.creditLimit);
      }
    }
  });

  it('includes every customer, inactive ones too', () => {
    expect(customerPositions(sampleData, '2026-08-31')).toHaveLength(8);
    expect(customerAt('C008', '2026-08-31')).toMatchObject({ netBalance: 0 });
  });
});

describe('R14: control check', () => {
  it('spot check 10: no differences for any customer on any day, 01-Jan to 31-Oct-2026', () => {
    let days = 0;
    for (let d = '2026-01-01'; d <= '2026-10-31'; d = addDays(d, 1)) {
      expect(balanceCheck(sampleData, d), d).toEqual([]);
      days++;
    }
    expect(days).toBe(304);
  });

  it('balanceByDocuments matches spot checks 5 and 6', () => {
    const c005 = sampleData.customers.find((c) => c.code === 'C005')!.id;
    expect(balanceByDocuments(sampleData, c005, '2026-08-31')).toBe(8880000);
    expect(balanceByDocuments(sampleData, c005, '2026-07-12')).toBe(-10000000);
  });

  it('catches a difference when the data is broken', () => {
    // An allocation to an invoice of another customer would move balance between ledgers
    const broken = {
      ...sampleData,
      allocations: sampleData.allocations.map((a, i) => (i === 0 ? { ...a, invoiceId: sampleData.invoices[0].id } : a)),
    };
    expect(balanceCheck(broken, '2026-08-31').length).toBeGreaterThan(0);
  });
});
