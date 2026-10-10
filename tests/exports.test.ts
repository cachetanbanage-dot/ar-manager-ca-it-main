import { describe, expect, it } from 'vitest';
import { fyStart } from '@/lib/ar/dates';
import { statement } from '@/lib/ar/statement';
import { csvField, toCsv } from '@/lib/csv';
import { ageingRowsCsv, invoiceListRowsCsv, statementRows } from '@/lib/exports';
import { dashboard } from '@/lib/lists/dashboard';
import { invoiceListOptions, invoiceListRows } from '@/lib/lists/invoices';
import { sampleData } from './fixture';

describe('CSV helpers (section 4.12)', () => {
  it('quotes only fields that need it, doubling quotes inside', () => {
    expect(csvField('Monthly accounting retainer, Apr')).toBe('"Monthly accounting retainer, Apr"');
    expect(csvField('He said "pay"')).toBe('"He said ""pay"""');
    expect(csvField('two\nlines')).toBe('"two\nlines"');
    expect(csvField('BWA/26-27/0001')).toBe('BWA/26-27/0001');
    expect(csvField(70800)).toBe('70800');
    expect(csvField(null)).toBe('');
  });

  it('starts with a UTF-8 BOM and ends each line with CRLF', () => {
    expect(toCsv([['a', 'b,c'], ['1', '2']])).toBe('﻿a,"b,c"\r\n1,2\r\n');
  });
});

describe('fyStart', () => {
  it('is 1 April of the financial year', () => {
    expect(fyStart('2026-08-31')).toBe('2026-04-01');
    expect(fyStart('2026-04-01')).toBe('2026-04-01');
    expect(fyStart('2026-03-31')).toBe('2025-04-01');
  });
});

describe('statement CSV', () => {
  it('spot check 8: C002 from 01-Apr-2026 to 31-Aug-2026', () => {
    const c002 = sampleData.customers.find((c) => c.code === 'C002')!.id;
    const rows = statementRows(statement(sampleData, c002, '2026-04-01', '2026-08-31'));
    expect(rows.slice(0, 10)).toEqual([
      ['Date', 'Document', 'Description', 'Debit', 'Credit', 'Balance', 'Dr/Cr'],
      ['01-Apr-2026', '', 'Opening balance', '', '', '70800.00', 'Dr'],
      ['18-Apr-2026', 'BWA/26-27/0003', 'Transfer pricing documentation', '141600.00', '', '212400.00', 'Dr'],
      ['20-May-2026', 'RCT/26-27/0005', 'Payment received', '', '64800.00', '147600.00', 'Dr'],
      ['20-May-2026', 'RCT/26-27/0005', 'TDS deducted by you', '', '6000.00', '141600.00', 'Dr'],
      ['22-May-2026', 'BWA/26-27/0009', 'Customs duty refund advisory', '94400.00', '', '236000.00', 'Dr'],
      ['15-Jun-2026', 'RCT/26-27/0007', 'Payment received', '', '60000.00', '176000.00', 'Dr'],
      ['15-Jun-2026', 'RCT/26-27/0007', 'TDS deducted by you', '', '12000.00', '164000.00', 'Dr'],
      ['20-Jul-2026', 'BWA/26-27/0018', 'Freight cost benchmarking', '59000.00', '', '223000.00', 'Dr'],
      ['31-Aug-2026', '', 'Closing balance', '', '', '223000.00', 'Dr'],
    ]);
  });

  it('shows a credit balance as Cr (C005 as at 12-Jul-2026)', () => {
    const c005 = sampleData.customers.find((c) => c.code === 'C005')!.id;
    const rows = statementRows(statement(sampleData, c005, '2026-07-01', '2026-07-12'));
    expect(rows.find((r) => r[2] === 'Closing balance')).toEqual(['12-Jul-2026', '', 'Closing balance', '', '', '100000.00', 'Cr']);
    expect(rows.at(-1)).toEqual(['Unapplied credit', '', '', '', '', '100000.00', 'Cr']);
  });
});

describe('invoice list and ageing CSV', () => {
  it('invoice CSV totals match the list totals', () => {
    const { rows, totals } = invoiceListRows(sampleData, '2026-08-31', invoiceListOptions({ status: 'Overdue' }));
    const csv = invoiceListRowsCsv(rows, totals);
    expect(csv).toHaveLength(rows.length + 2);
    expect(csv.at(-1)![8]).toBe('1286200.00'); // the overdue total on the dashboard
  });

  it('ageing CSV totals match the dashboard', () => {
    const d = dashboard(sampleData, '2026-08-31');
    const csv = ageingRowsCsv(d.ageing, d.ageingTotals);
    expect(csv[0]).toEqual(['Code', 'Customer', 'Not due', '1-15', '16-30', '31-45', '46-90', 'Over 90', 'Outstanding', 'Unapplied credit', 'Net balance', 'Dr/Cr']);
    expect(csv.at(-1)).toEqual(['Total', '', '831900.00', '507400.00', '118000.00', '129800.00', '167000.00', '364000.00', '2118100.00', '100000.00', '2018100.00', 'Dr']);
  });
});
