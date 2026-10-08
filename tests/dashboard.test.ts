import { describe, expect, it } from 'vitest';
import { addDays } from '@/lib/ar/dates';
import { dashboardSummary } from '@/lib/ar/dashboard';
import { dashboard } from '@/lib/lists/dashboard';
import { sampleData } from './fixture';

describe('dashboard summary', () => {
  it('as at 31-Aug-2026 (worked by hand)', () => {
    expect(dashboardSummary(sampleData, '2026-08-31')).toEqual({
      outstanding: 211810000, // 21,18,100.00
      unapplied: 10000000, // C005's advance
      netReceivable: 201810000,
      overdue: 128620000, // 21,18,100 − 8,31,900 not yet due
      overduePct: 60.7,
      dso: 111,
      overdueCount: 11,
    });
  });

  it('has no overdue percentage when nothing is outstanding', () => {
    expect(dashboardSummary(sampleData, '2025-12-31')).toMatchObject({ outstanding: 0, overduePct: null, dso: null, overdueCount: 0 });
  });
});

describe('dashboard', () => {
  const d = dashboard(sampleData, '2026-08-31');
  const codes = (rows: { customer: { code: string } }[]) => rows.map((r) => r.customer.code);

  it('ageing totals equal the summary figures, every week of the year', () => {
    for (let day = '2026-01-04'; day <= '2026-10-31'; day = addDays(day, 7)) {
      const x = dashboard(sampleData, day);
      expect(x.ageingTotals.outstanding, day).toBe(x.summary.outstanding);
      expect(x.ageingTotals.unapplied, day).toBe(x.summary.unapplied);
      expect(x.ageingTotals.netBalance, day).toBe(x.summary.netReceivable);
      expect(x.ageingTotals.overdue, day).toBe(x.summary.overdue);
      expect(Object.values(x.ageingTotals.buckets).reduce((a, b) => a + b, 0), day).toBe(x.summary.outstanding);
    }
  });

  it('lists customers with something outstanding or unapplied, and the bucket totals', () => {
    // C001 still owes 0021 (paid 10-Sep); C008 has nothing open
    expect(codes(d.ageing)).toEqual(['C001', 'C002', 'C003', 'C004', 'C005', 'C006', 'C007']);
    expect(d.ageingTotals.buckets['Not due']).toBe(83190000);
  });

  it('lists overdue invoices longest late first', () => {
    expect(d.overdueInvoices).toHaveLength(11);
    expect(d.overdueInvoices[0]).toMatchObject({ daysPastDue: 193 });
    expect(d.overdueInvoices[0].invoice.invoiceNo).toBe('BWA/25-26/0141');
    const days = d.overdueInvoices.map((p) => p.daysPastDue);
    expect(days).toEqual([...days].sort((a, b) => b - a));
  });

  it('needs attention as at 31-Aug-2026', () => {
    expect(codes(d.overLimit)).toEqual(['C003']); // 4,46,600 against 4,00,000
    expect(codes(d.brokenPromises)).toEqual(['C002']); // spot check 9
    expect(d.followUps).toEqual([]); // the first follow-up is 01-Sep
    expect(codes(d.unappliedCredit)).toEqual(['C005']);
  });

  it('follow-ups due as at 10-Sep-2026', () => {
    expect(codes(dashboard(sampleData, '2026-09-10').followUps)).toEqual(['C006', 'C004', 'C004']);
  });
});
