import { describe, expect, it } from 'vitest';
import { allocationProblems, allocationSummary, openInvoices, receiptRemaining, suggestAllocations, tdsPrefill } from '@/lib/ar/receipts';
import { checkAllocation, checkReceipt } from '@/lib/validation/receipt';
import { sampleData } from './fixture';

const cust = (code: string) => sampleData.customers.find((c) => c.code === code)!;
const inv = (no: string) => sampleData.invoices.find((i) => i.invoiceNo === no)!;
const rct = (no: string) => sampleData.receipts.find((r) => r.receiptNo === no)!;

describe('tdsPrefill (R5)', () => {
  it('matches what the sample customers deducted', () => {
    expect(tdsPrefill(8100000, 10)).toBe(750000); // C001: 81,000 → 7,500
    expect(tdsPrefill(21600000, 10)).toBe(2000000); // C004: 2,16,000 → 20,000
    expect(tdsPrefill(57240000, 10)).toBe(5300000); // C007: 5,72,400 → 53,000
  });
  it('is zero with no TDS rate or no bank amount', () => {
    expect(tdsPrefill(2950000, 0)).toBe(0); // C006 deducts no TDS
    expect(tdsPrefill(0, 10)).toBe(0);
  });
});

describe('receiptRemaining', () => {
  it('is settlement less every allocation, whatever its date', () => {
    expect(receiptRemaining(sampleData, rct('RCT/26-27/0011').id)).toBe(0); // advance allocated on 05-Sep
    expect(receiptRemaining(sampleData, rct('RCT/26-27/0013').id)).toBe(0);
  });
});

describe('openInvoices and suggestAllocations (R6)', () => {
  it('lists open invoices oldest first by due date, then number', () => {
    const open = openInvoices(sampleData, cust('C003').id, '2026-10-31');
    expect(open.map((o) => [o.invoice.invoiceNo, o.remaining])).toEqual([
      ['BWA/25-26/0141', 17700000], ['BWA/25-26/0156', 5720000], ['BWA/26-27/0004', 12980000], ['BWA/26-27/0013', 8260000],
    ]);
  });

  it('leaves out invoices dated after the allocation date, paid or cancelled', () => {
    const nos = (code: string, date: string) => openInvoices(sampleData, cust(code).id, date).map((o) => o.invoice.invoiceNo);
    expect(nos('C003', '2026-06-01')).toEqual(['BWA/25-26/0141', 'BWA/25-26/0156', 'BWA/26-27/0004']); // 0013 dated 28-Jun
    expect(nos('C007', '2026-10-31')).toEqual(['BWA/26-27/0023']); // 0014 cancelled; 0002, 0008, 0015 paid
    expect(nos('C007', '2026-08-01')).toEqual([]); // 0015 was paid on 08-Sep, and every allocation counts
  });

  it('fills invoices oldest first and leaves the rest unapplied', () => {
    const open = openInvoices(sampleData, cust('C003').id, '2026-10-31');
    const s = suggestAllocations(open, 20000000); // 2,00,000
    expect([...s.values()]).toEqual([17700000, 2300000]);
    expect(suggestAllocations(open, 0).size).toBe(0);
    const all = suggestAllocations(open, 50000000); // more than everything open
    expect([...all.values()].reduce((a, b) => a + b, 0)).toBe(44660000);
  });
});

describe('allocationProblems (R6)', () => {
  const c003 = cust('C003').id;
  const check = (lines: { invoiceId: number; amount: number }[], opts: { available?: number; receiptDate?: string; allocationDate?: string; customer?: number } = {}) =>
    allocationProblems(sampleData, opts.customer ?? c003, opts.receiptDate ?? '2026-10-01', opts.allocationDate ?? '2026-10-01', opts.available ?? 50000000, lines);

  it('accepts valid allocations', () => {
    expect(check([{ invoiceId: inv('BWA/25-26/0141').id, amount: 17700000 }])).toEqual([]);
  });

  it('refuses more than the invoice has open', () => {
    expect(check([{ invoiceId: inv('BWA/25-26/0156').id, amount: 5720001 }]))
      .toEqual(['BWA/25-26/0156 has only ₹57,200.00 open; ₹57,200.01 was entered.']);
  });

  it('refuses more than the receipt can give', () => {
    expect(check([{ invoiceId: inv('BWA/25-26/0141').id, amount: 17700000 }], { available: 10000000 }))
      .toEqual(['The allocations add up to ₹1,77,000.00, more than the ₹1,00,000.00 available from the receipt.']);
  });

  it('refuses another customer’s invoice, a cancelled invoice and an early date', () => {
    expect(check([{ invoiceId: inv('BWA/26-27/0001').id, amount: 100 }]).join(' ')).toContain('belongs to another customer');
    expect(check([{ invoiceId: inv('BWA/26-27/0014').id, amount: 100 }], { customer: cust('C007').id }).join(' ')).toContain('cancelled');
    expect(check([], { receiptDate: '2026-10-02', allocationDate: '2026-10-01' }))
      .toEqual(['The allocation date cannot be earlier than the receipt date.']);
    expect(check([{ invoiceId: inv('BWA/26-27/0013').id, amount: 100 }], { allocationDate: '2026-06-01', receiptDate: '2026-06-01' }).join(' '))
      .toContain('dated after the allocation date');
  });

  it('ignores lines with nothing entered', () => {
    expect(check([{ invoiceId: inv('BWA/25-26/0141').id, amount: 0 }])).toEqual([]);
  });
});

describe('checkReceipt and checkAllocation', () => {
  const c003 = String(cust('C003').id);
  const base = { customerId: c003, receiptDate: '2026-10-05', bankAmount: '1,62,000', tdsAmount: '15,000', mode: 'NEFT', reference: 'UTR 1005-1' };

  it('accepts a receipt with allocations dated the receipt date', () => {
    const r = checkReceipt({ ...base, [`alloc_${inv('BWA/25-26/0141').id}`]: '1,77,000', [`alloc_${inv('BWA/25-26/0156').id}`]: '' }, sampleData);
    expect(r.ok && r.data).toEqual({
      receipt: { customerId: Number(c003), receiptDate: '2026-10-05', bankAmount: 16200000, tdsAmount: 1500000, mode: 'NEFT', reference: 'UTR 1005-1' },
      lines: [{ invoiceId: inv('BWA/25-26/0141').id, amount: 17700000 }],
    });
  });

  it('accepts a receipt with nothing allocated (all unapplied)', () => {
    expect(checkReceipt(base, sampleData).ok).toBe(true);
  });

  it('refuses allocations above the settlement value (bank + TDS)', () => {
    const r = checkReceipt({ ...base, bankAmount: '1,00,000', tdsAmount: '0', [`alloc_${inv('BWA/25-26/0141').id}`]: '1,77,000' }, sampleData);
    expect(!r.ok && r.errors.allocations?.join(' ')).toContain('more than the ₹1,00,000.00 available');
  });

  it('checks the receipt fields', () => {
    const r = checkReceipt({ customerId: '', receiptDate: 'x', bankAmount: '-1', tdsAmount: '', mode: 'Cash', reference: '' }, sampleData);
    expect(!r.ok && Object.keys(r.errors).sort()).toEqual(['bankAmount', 'customerId', 'mode', 'receiptDate', 'reference', 'tdsAmount']);
    const zero = checkReceipt({ ...base, bankAmount: '0', tdsAmount: '0' }, sampleData);
    expect(!zero.ok && zero.errors.bankAmount).toBeDefined();
  });

  it('allocates later credit with its own date, not before the receipt', () => {
    // RCT/26-27/0011 (C005) is fully allocated, so a test copy with the allocation removed
    const r11 = rct('RCT/26-27/0011');
    const data = { ...sampleData, allocations: sampleData.allocations.filter((a) => a.receiptId !== r11.id) };
    const line = { [`alloc_${inv('BWA/26-27/0022').id}`]: '70,800' };
    expect(checkAllocation({ allocationDate: '2026-08-31', ...line }, data, r11.id).ok).toBe(true);
    const early = checkAllocation({ allocationDate: '2026-07-09', ...line }, data, r11.id);
    expect(!early.ok && early.errors.allocationDate?.[0]).toContain('before the receipt date');
    const before = checkAllocation({ allocationDate: '2026-08-19', ...line }, data, r11.id); // 0022 is dated 20-Aug
    expect(!before.ok && before.errors.allocations?.[0]).toContain('dated after the allocation date');
    const none = checkAllocation({ allocationDate: '2026-08-31' }, data, r11.id);
    expect(!none.ok && none.errors.allocations).toBeDefined();
    expect(checkAllocation({ allocationDate: '2026-08-31', ...line }, sampleData, r11.id).ok).toBe(false); // nothing left
  });
});

describe('allocationSummary', () => {
  it('adds up the amounts and shows what stays unapplied', () => {
    expect(allocationSummary(10000000, [6000000, 1000000, 0])).toEqual({ allocated: 7000000, unapplied: 3000000 });
    expect(allocationSummary(10000000, [12000000])).toEqual({ allocated: 12000000, unapplied: -2000000 });
  });
});
