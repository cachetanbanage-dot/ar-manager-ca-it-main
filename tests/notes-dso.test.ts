import { describe, expect, it } from 'vitest';
import { dso } from '@/lib/ar/dso';
import { followUpsDue, promiseStatuses } from '@/lib/ar/notes';
import { invoicePositions } from '@/lib/ar/positions';
import { sampleData } from './fixture';

const promiseOf = (code: string, noteDate: string, asOf: string) =>
  promiseStatuses(sampleData, asOf).find((p) => p.customer.code === code && p.note.noteDate === noteDate);

describe('R16: promises to pay', () => {
  it('spot check 9: C002 promise noted 20-Jul-2026 is Broken as at 31-Aug-2026', () => {
    expect(promiseOf('C002', '2026-07-20', '2026-08-31')).toMatchObject({ status: 'Broken', received: 0, promiseAmount: 6960000 });
  });

  it('is Pending up to and on the promise date, Broken the day after', () => {
    expect(promiseOf('C002', '2026-07-20', '2026-07-25')!.status).toBe('Pending');
    expect(promiseOf('C002', '2026-07-20', '2026-08-01')!.status).toBe('Pending');
    expect(promiseOf('C002', '2026-07-20', '2026-08-02')!.status).toBe('Broken');
  });

  it('C002 promise of 02-Sep is Kept once RCT/26-27/0016 (86,400 + 8,000 TDS) arrives on 09-Sep', () => {
    expect(promiseOf('C002', '2026-09-02', '2026-08-31')).toBeUndefined(); // note not written yet
    expect(promiseOf('C002', '2026-09-02', '2026-09-08')).toMatchObject({ status: 'Pending', received: 0 });
    expect(promiseOf('C002', '2026-09-02', '2026-09-09')).toMatchObject({ status: 'Kept', received: 9440000 });
    expect(promiseOf('C002', '2026-09-02', '2026-10-31')!.status).toBe('Kept');
  });

  it('C003 promise of 10-Aug (by 30-Sep) is Pending to 30-Sep and Broken from 01-Oct', () => {
    expect(promiseOf('C003', '2026-08-10', '2026-08-31')!.status).toBe('Pending');
    expect(promiseOf('C003', '2026-08-10', '2026-09-30')!.status).toBe('Pending');
    expect(promiseOf('C003', '2026-08-10', '2026-10-01')!.status).toBe('Broken');
  });

  it('only counts notes with a promise', () => {
    expect(promiseStatuses(sampleData, '2026-10-31')).toHaveLength(3);
  });
});

describe('R16: follow-ups due', () => {
  it('lists open follow-ups dated on or before the as-at date', () => {
    const due = (asOf: string) => followUpsDue(sampleData, asOf).map((f) => `${f.customer.code} ${f.note.followUpDate}`);
    expect(due('2026-08-31')).toEqual([]);
    expect(due('2026-09-01')).toEqual(['C006 2026-09-01']);
    expect(due('2026-09-10')).toEqual(['C006 2026-09-01', 'C004 2026-09-05', 'C004 2026-09-10']);
    expect(due('2026-10-31')).toHaveLength(4);
  });

  it('leaves out follow-ups marked done', () => {
    const data = { ...sampleData, notes: sampleData.notes.map((n) => ({ ...n, followUpDone: true })) };
    expect(followUpsDue(data, '2026-10-31')).toEqual([]);
  });
});

describe('R17: DSO', () => {
  it('as at 31-Aug-2026: 21,18,100.00 outstanding ÷ 17,16,900.00 sales × 90 = 111 days', () => {
    const outstanding = invoicePositions(sampleData, '2026-08-31').reduce((s, p) => s + p.outstanding, 0);
    expect(outstanding).toBe(211810000);
    // Sales 03-Jun to 31-Aug: 17,46,400.00 of invoices (0014 cancelled) − 29,500.00 credit note
    expect(dso(sampleData, '2026-08-31')).toBe(111);
  });

  it('includes an invoice dated exactly D−89 and excludes one dated D−90', () => {
    // BWA/25-26/0141 (1,77,000.00, unpaid) is dated 20-Jan-2026
    expect(dso(sampleData, '2026-04-19')).not.toBeNull(); // 20-Jan is D−89
    expect(dso(sampleData, '2026-01-20')).toBe(90); // only 0141 in the window, all outstanding
  });

  it('is null when there are no sales in the window', () => {
    expect(dso(sampleData, '2026-01-19')).toBeNull();
  });
});
