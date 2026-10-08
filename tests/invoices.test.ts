import { describe, expect, it } from 'vitest';
import { cancelBlocker, invoiceRemaining } from '@/lib/ar/invoices';
import { invoiceDetail } from '@/lib/lists/invoice-detail';
import { checkInvoice } from '@/lib/validation/invoice';
import { sampleData } from './fixture';

const inv = (no: string) => sampleData.invoices.find((i) => i.invoiceNo === no)!;

describe('invoiceRemaining (all records, any date)', () => {
  it('is the total less every allocation and credit note', () => {
    expect(invoiceRemaining(sampleData, inv('BWA/26-27/0007').id)).toBe(300000); // 2,95,000 − 29,500 − 2,62,500
    expect(invoiceRemaining(sampleData, inv('BWA/26-27/0013').id)).toBe(8260000); // nothing received
    expect(invoiceRemaining(sampleData, inv('BWA/26-27/0001').id)).toBe(0);
  });

  it('counts allocations dated later than any as-at date (0017: advance allocated on 05-Sep)', () => {
    expect(invoiceRemaining(sampleData, inv('BWA/26-27/0017').id)).toBe(1800000);
  });

  it('is zero for a cancelled invoice', () => {
    expect(invoiceRemaining(sampleData, inv('BWA/26-27/0014').id)).toBe(0);
  });
});

describe('cancelBlocker (R8)', () => {
  it('allows cancelling an invoice with nothing against it', () => {
    expect(cancelBlocker(sampleData, inv('BWA/26-27/0013').id)).toBeNull();
  });

  it('refuses when payments or credit notes exist, and says why', () => {
    expect(cancelBlocker(sampleData, inv('BWA/26-27/0007').id))
      .toBe('BWA/26-27/0007 cannot be cancelled: it has 1 payment allocation and 1 credit note against it. Remove the allocations or raise a credit note instead.');
    expect(cancelBlocker(sampleData, inv('BWA/26-27/0017').id)).toContain('1 payment allocation');
  });

  it('refuses an invoice already cancelled', () => {
    expect(cancelBlocker(sampleData, inv('BWA/26-27/0014').id)).toBe('BWA/26-27/0014 is already cancelled.');
  });
});

describe('invoice page', () => {
  it('shows BWA/26-27/0007 as at 31-Aug-2026 (spot check 7)', () => {
    const d = invoiceDetail(sampleData, inv('BWA/26-27/0007').id, '2026-08-31')!;
    expect(d.row).toMatchObject({ outstanding: 300000, credited: 2950000, received: 26250000 });
    expect(d.allocations.map((a) => [a.receipt.receiptNo, a.allocation.amount])).toEqual([['RCT/26-27/0013', 26250000]]);
    expect(d.creditNotes.map((c) => c.creditNoteNo)).toEqual(['BWA/CN/26-27/001']);
    expect(d.notes).toHaveLength(1);
    expect(d.laterRecords).toBe(0);
    expect(d.remaining).toBe(300000);
  });

  it('counts allocations after the as-at date separately (0017 on 31-Aug)', () => {
    const d = invoiceDetail(sampleData, inv('BWA/26-27/0017').id, '2026-08-31')!;
    expect(d.allocations).toHaveLength(0);
    expect(d.laterRecords).toBe(1);
    expect(d.row!.outstanding).toBe(11800000);
    expect(d.remaining).toBe(1800000);
  });

  it('has no position before the invoice date', () => {
    expect(invoiceDetail(sampleData, inv('BWA/26-27/0024').id, '2026-08-31')!.row).toBeNull();
  });
});

describe('previewInvoice and checkInvoice (R2, R3, R4, R9)', () => {
  const cust = (code: string) => sampleData.customers.find((c) => c.code === code)!;
  const form = (o: Record<string, string> = {}) => ({
    customerId: String(cust('C001').id), invoiceDate: '2026-10-05', description: 'Monthly accounting retainer, Oct',
    taxableValue: '75,000', gstRatePct: '18', ...o,
  });

  it('works out number, due date, GST, total and balance for C001', () => {
    const r = checkInvoice(form(), sampleData);
    expect(r.ok && r.data.preview).toEqual({
      invoiceNo: 'BWA/26-27/0025', dueDate: '2026-11-04', cgst: 675000, sgst: 675000, igst: 0, total: 8850000,
      balanceBefore: 8850000, balanceAfter: 17700000, creditLimit: 50000000, overLimit: false,
    });
  });

  it('charges IGST outside Maharashtra and warns (but allows) going over the credit limit', () => {
    // C003 (Karnataka) owes 4,46,600 against a 4,00,000 limit
    const r = checkInvoice(form({ customerId: String(cust('C003').id), taxableValue: '10000' }), sampleData);
    expect(r.ok).toBe(true);
    expect(r.ok && r.data.preview).toMatchObject({ igst: 180000, total: 1180000, balanceBefore: 44660000, overLimit: true });
  });

  it('numbers a backdated FY 2025-26 invoice in that year’s series', () => {
    const r = checkInvoice(form({ invoiceDate: '2026-03-31' }), sampleData);
    expect(r.ok && r.data.preview.invoiceNo).toBe('BWA/25-26/0172');
  });

  it('refuses an inactive customer (R9)', () => {
    const r = checkInvoice(form({ customerId: String(cust('C008').id) }), sampleData);
    expect(!r.ok && r.errors.customerId?.[0]).toContain('inactive');
  });

  it('checks every field', () => {
    const r = checkInvoice({ customerId: '', invoiceDate: '2026-02-30', description: ' ', taxableValue: '0', gstRatePct: '15' }, sampleData);
    expect(!r.ok && Object.keys(r.errors).sort()).toEqual(['customerId', 'description', 'gstRatePct', 'invoiceDate', 'taxableValue']);
  });
});
