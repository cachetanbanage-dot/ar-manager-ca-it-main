import { describe, expect, it } from 'vitest';
import { creditUsedPct } from '@/lib/ar/customers';
import { invoiceRows } from '@/lib/ar/positions';
import { customerDetail, customerListOptions, customerListRows } from '@/lib/lists/customers';
import { checkCustomer } from '@/lib/validation/customer';
import { sampleData } from './fixture';

describe('creditUsedPct', () => {
  it('is the net balance as a whole percentage of the limit', () => {
    expect(creditUsedPct(8880000, 25000000)).toBe(36); // C005 on 31-Aug: 88,800 of 2,50,000 = 35.52%
    expect(creditUsedPct(25000000, 25000000)).toBe(100);
    expect(creditUsedPct(30000000, 25000000)).toBe(120);
  });
  it('is 0% for a credit or zero balance, and null when the limit is zero', () => {
    expect(creditUsedPct(-10000000, 25000000)).toBe(0);
    expect(creditUsedPct(0, 0)).toBe(0);
    expect(creditUsedPct(100, 0)).toBeNull();
  });
});

describe('invoiceRows', () => {
  it('lists cancelled invoices as Cancelled with nothing outstanding', () => {
    const rows = invoiceRows(sampleData, '2026-08-31');
    const cancelled = rows.find((r) => r.invoice.invoiceNo === 'BWA/26-27/0014')!;
    expect(cancelled).toMatchObject({ status: 'Cancelled', outstanding: 0, bucket: null });
    expect(rows).toHaveLength(28); // 0024 (05-Sep) not yet raised; 0014 included as Cancelled
  });
});

describe('customer list', () => {
  const codes = (opts: Parameters<typeof customerListRows>[2]) =>
    customerListRows(sampleData, '2026-08-31', opts).map((r) => r.customer.code);

  it('shows every customer by code by default', () => {
    expect(codes({})).toEqual(['C001', 'C002', 'C003', 'C004', 'C005', 'C006', 'C007', 'C008']);
  });

  it('searches code, name, contact and email, ignoring case', () => {
    expect(codes({ q: 'c005' })).toEqual(['C005']);
    expect(codes({ q: 'freight' })).toEqual(['C002']);
    expect(codes({ q: 'lakshmi' })).toEqual(['C007']);
    expect(codes({ q: 'mulshiagro@' })).toEqual(['C006']);
    expect(codes({ q: 'nobody' })).toEqual([]);
  });

  it('filters active and inactive customers', () => {
    expect(codes({ status: 'inactive' })).toEqual(['C008']);
    expect(codes({ status: 'active' })).toHaveLength(7);
  });

  it('sorts by any column, both ways', () => {
    expect(codes({ sort: 'balance', dir: 'desc' })[0]).toBe('C007'); // 7,31,600.00 Dr is the largest on 31-Aug
    expect(codes({ sort: 'creditDays', dir: 'asc' })[0]).toBe('C006'); // 15 days
    expect(codes({ sort: 'name', dir: 'asc' }).slice(0, 3)).toEqual(['C008', 'C007', 'C003']); // Kamshet, Krishnaveni, Kundalika
    expect(codes({ sort: 'name', dir: 'desc' })[0]).toBe('C002'); // Varandha
  });

  it('carries the figures from lib/ar', () => {
    const c005 = customerListRows(sampleData, '2026-08-31').find((r) => r.customer.code === 'C005')!;
    expect(c005).toMatchObject({ netBalance: 8880000, usedPct: 36 });
  });

  it('reads options from the URL and ignores anything unexpected', () => {
    expect(customerListOptions({ q: 'x', status: 'inactive', sort: 'balance', dir: 'desc' }))
      .toEqual({ q: 'x', status: 'inactive', sort: 'balance', dir: 'desc' });
    expect(customerListOptions({ status: 'deleted', sort: 'drop table', dir: 'up' }))
      .toEqual({ q: '', status: 'all', sort: 'code', dir: 'asc' });
  });
});

describe('customer form checks', () => {
  const valid = {
    code: 'c099', name: 'Test Customer', city: 'Pune', state: 'Maharashtra', contactPerson: 'A Person',
    email: 'test@example.com', phone: '', gstin: '', creditDays: '30', creditLimit: '5,00,000', tdsRatePct: '10',
  };

  it('accepts a valid customer and converts amounts to paise', () => {
    const r = checkCustomer(valid, sampleData.customers);
    expect(r).toEqual({
      ok: true,
      data: {
        code: 'C099', name: 'Test Customer', city: 'Pune', state: 'Maharashtra', contactPerson: 'A Person',
        email: 'test@example.com', phone: null, gstin: null, creditDays: 30, creditLimit: 50000000, tdsRatePct: 10,
      },
    });
  });

  const errorsFor = (changes: Record<string, string>, editingId?: number) => {
    const r = checkCustomer({ ...valid, ...changes }, sampleData.customers, editingId);
    return r.ok ? {} : r.errors;
  };

  it('requires the main fields', () => {
    const e = errorsFor({ code: '', name: ' ', city: '', contactPerson: '', email: '' });
    expect(Object.keys(e).sort()).toEqual(['city', 'code', 'contactPerson', 'email', 'name']);
  });

  it('rejects a code already used, but not the customer’s own code when editing', () => {
    expect(errorsFor({ code: 'c001' }).code?.[0]).toBe('Code C001 is already used by Tamhini Foods Pvt. Ltd.');
    const c001 = sampleData.customers.find((c) => c.code === 'C001')!;
    expect(errorsFor({ code: 'C001' }, c001.id)).toEqual({});
  });

  it('checks email, credit days, credit limit, TDS rate and GSTIN', () => {
    expect(errorsFor({ email: 'not-an-email' }).email).toBeDefined();
    expect(errorsFor({ creditDays: '-1' }).creditDays).toBeDefined();
    expect(errorsFor({ creditDays: '30.5' }).creditDays).toBeDefined();
    expect(errorsFor({ creditLimit: '-5' }).creditLimit).toBeDefined();
    expect(errorsFor({ creditLimit: '100.555' }).creditLimit).toBeDefined();
    expect(errorsFor({ tdsRatePct: '101' }).tdsRatePct).toBeDefined();
    expect(errorsFor({ tdsRatePct: '0' })).toEqual({});
    expect(errorsFor({ tdsRatePct: '100' })).toEqual({});
    expect(errorsFor({ gstin: '27ABCDE1234F1Z' }).gstin).toBeDefined(); // 14 characters
    expect(errorsFor({ gstin: '27abcde1234f1z5' })).toEqual({}); // 15, upper-cased
    expect(errorsFor({ state: 'Maharastra' }).state).toBeDefined(); // typo: would wrongly charge IGST
  });
});

describe('customer page', () => {
  it('gathers C005 as at 31-Aug-2026: invoices, the unapplied advance, and its note', () => {
    const c005 = sampleData.customers.find((c) => c.code === 'C005')!;
    const d = customerDetail(sampleData, c005.id, '2026-08-31')!;
    expect(d.position).toMatchObject({ netBalance: 8880000, unapplied: 10000000, usedPct: 36 });
    expect(d.invoices.map((r) => r.invoice.invoiceNo)).toEqual(['BWA/26-27/0017', 'BWA/26-27/0022']);
    expect(d.receipts.map((r) => [r.receipt.receiptNo, r.unapplied])).toEqual([['RCT/26-27/0011', 10000000]]);
    expect(d.notes).toHaveLength(1);
  });

  it('shows notes newest first, with follow-up due and promise status as at the date', () => {
    const c002 = sampleData.customers.find((c) => c.code === 'C002')!;
    const notes = customerDetail(sampleData, c002.id, '2026-09-30')!.notes;
    expect(notes.map((n) => [n.note.noteDate, n.invoiceNo, n.promiseStatus])).toEqual([
      ['2026-09-02', 'BWA/26-27/0009', 'Kept'],
      ['2026-07-20', 'BWA/26-27/0003', 'Broken'],
    ]);
    const c004 = sampleData.customers.find((c) => c.code === 'C004')!;
    const due = customerDetail(sampleData, c004.id, '2026-09-06')!.notes.map((n) => [n.note.followUpDate, n.followUpDue]);
    expect(due).toEqual([['2026-09-05', true], ['2026-09-10', false]]);
  });

  it('returns null for an unknown customer', () => {
    expect(customerDetail(sampleData, -1, '2026-08-31')).toBeNull();
  });
});
