import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, dueDate, fyLabel } from '@/lib/ar/dates';
import { creditNoteAmounts, gstSplit, invoiceAmounts } from '@/lib/ar/gst';
import { nextNumber } from '@/lib/ar/numbering';
import { sampleData } from './fixture';

const invoice = (no: string) => sampleData.invoices.find((i) => i.invoiceNo === no)!;
const customer = (id: number) => sampleData.customers.find((c) => c.id === id)!;

describe('dates', () => {
  it('counts days between dates', () => {
    expect(daysBetween('2026-06-02', '2026-08-31')).toBe(90);
    expect(daysBetween('2026-08-31', '2026-08-31')).toBe(0);
    expect(daysBetween('2026-09-04', '2026-08-31')).toBe(-4);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
  });

  it('adds days across month, year and leap-day boundaries', () => {
    expect(addDays('2026-01-31', 30)).toBe('2026-03-02');
    expect(addDays('2026-12-15', 30)).toBe('2027-01-14');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('R2: due date = invoice date + credit days (spot check 1)', () => {
    expect(dueDate('2026-04-05', 30)).toBe('2026-05-05');
    expect(dueDate('2026-04-05', 0)).toBe('2026-04-05');
  });

  it('R2: matches the due date stored on every sample invoice', () => {
    for (const inv of sampleData.invoices) {
      expect(dueDate(inv.invoiceDate, customer(inv.customerId).creditDays), inv.invoiceNo).toBe(inv.dueDate);
    }
  });

  it('R4: financial year changes on 1 April', () => {
    expect(fyLabel('2026-03-31')).toBe('25-26');
    expect(fyLabel('2026-04-01')).toBe('26-27');
    expect(fyLabel('2027-01-15')).toBe('26-27');
    expect(fyLabel('2099-04-01')).toBe('99-00');
  });
});

describe('GST', () => {
  it('spot check 1: Maharashtra customer gets CGST + SGST', () => {
    expect(invoiceAmounts('Maharashtra', 7500000, 18)).toEqual({ cgst: 675000, sgst: 675000, igst: 0, total: 8850000 });
  });

  it('spot check 2: other states get IGST', () => {
    expect(invoiceAmounts('Telangana', 35000000, 18)).toEqual({ cgst: 0, sgst: 0, igst: 6300000, total: 41300000 });
  });

  it('rounds each component to the paisa, halves up', () => {
    expect(gstSplit('Maharashtra', 50, 18)).toEqual({ cgst: 5, sgst: 5, igst: 0 }); // 4.5 paise each → 5
    expect(gstSplit('Karnataka', 25, 18)).toEqual({ cgst: 0, sgst: 0, igst: 5 }); // 4.5 paise → 5
    expect(gstSplit('Maharashtra', 49, 18)).toEqual({ cgst: 4, sgst: 4, igst: 0 }); // 4.41 paise → 4
  });

  it('matches the GST and total stored on every sample invoice', () => {
    for (const inv of sampleData.invoices) {
      const expected = invoiceAmounts(customer(inv.customerId).state, inv.taxableValue, inv.gstRatePct);
      expect(expected, inv.invoiceNo).toEqual({ cgst: inv.cgst, sgst: inv.sgst, igst: inv.igst, total: inv.total });
    }
  });

  it('R7: a credit note follows its invoice rate and split', () => {
    const cn = sampleData.creditNotes[0];
    const inv = sampleData.invoices.find((i) => i.id === cn.invoiceId)!;
    expect(creditNoteAmounts(inv, cn.taxableValue)).toEqual({ cgst: cn.cgst, sgst: cn.sgst, igst: cn.igst, total: cn.total });
    expect(creditNoteAmounts(invoice('BWA/26-27/0002'), 1000000)).toEqual({ cgst: 0, sgst: 0, igst: 180000, total: 1180000 });
  });
});

describe('R4: numbering', () => {
  it('gives the next numbers after the sample data', () => {
    expect(nextNumber('invoice', sampleData, '2026-10-08')).toBe('BWA/26-27/0025');
    expect(nextNumber('creditNote', sampleData, '2026-10-08')).toBe('BWA/CN/26-27/002');
    expect(nextNumber('receipt', sampleData, '2026-10-08')).toBe('RCT/26-27/0018');
  });

  it('counts cancelled invoices, so their numbers are never reused', () => {
    const withoutLatest = { ...sampleData, invoices: sampleData.invoices.filter((i) => i.invoiceNo !== 'BWA/26-27/0024') };
    // 0014 is cancelled but still counts; the highest left is 0023
    expect(nextNumber('invoice', withoutLatest, '2026-10-08')).toBe('BWA/26-27/0024');
  });

  it('restarts each 1 April and continues the carried-over FY 2025-26 series', () => {
    expect(nextNumber('invoice', sampleData, '2026-03-31')).toBe('BWA/25-26/0172');
    expect(nextNumber('invoice', sampleData, '2027-04-01')).toBe('BWA/27-28/0001');
    expect(nextNumber('creditNote', sampleData, '2027-04-01')).toBe('BWA/CN/27-28/001');
    expect(nextNumber('receipt', sampleData, '2026-03-31')).toBe('RCT/25-26/0001');
  });

  it('keeps invoice numbers within 16 characters (GST Rule 46)', () => {
    expect(nextNumber('invoice', sampleData, '2026-10-08').length).toBeLessThanOrEqual(16);
  });
});
