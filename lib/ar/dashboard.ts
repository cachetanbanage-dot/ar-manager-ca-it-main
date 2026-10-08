// Overdue at a glance (Part 2): the summary figures and the ageing totals.
import { dso } from './dso';
import { BUCKETS, customerPositions, invoicePositions, type Bucket, type CustomerPosition } from './positions';
import type { ArData, Paise } from './types';

export interface DashboardSummary {
  outstanding: Paise; // Σ invoice outstanding, before unapplied credit
  unapplied: Paise;
  netReceivable: Paise; // outstanding − unapplied
  overdue: Paise; // outstanding − Not due
  overduePct: number | null; // overdue as a % of outstanding, one decimal; null when nothing is outstanding
  dso: number | null; // R17
  overdueCount: number; // invoices with status Overdue
}

export function dashboardSummary(data: ArData, asOf: string): DashboardSummary {
  const totals = ageingTotals(customerPositions(data, asOf));
  return {
    outstanding: totals.outstanding,
    unapplied: totals.unapplied,
    netReceivable: totals.netBalance,
    overdue: totals.overdue,
    overduePct: totals.outstanding > 0 ? Math.round((totals.overdue * 1000) / totals.outstanding) / 10 : null,
    dso: dso(data, asOf),
    overdueCount: invoicePositions(data, asOf).filter((p) => p.status === 'Overdue').length,
  };
}

export interface AgeingTotals {
  buckets: Record<Bucket, Paise>;
  outstanding: Paise;
  unapplied: Paise;
  netBalance: Paise;
  overdue: Paise;
}

/** R12 + R13: the totals row of the ageing table, adding up customer positions. */
export function ageingTotals(rows: CustomerPosition[]): AgeingTotals {
  const t: AgeingTotals = {
    buckets: Object.fromEntries(BUCKETS.map((b) => [b, 0])) as Record<Bucket, Paise>,
    outstanding: 0, unapplied: 0, netBalance: 0, overdue: 0,
  };
  for (const r of rows) {
    for (const b of BUCKETS) t.buckets[b] += r.buckets[b];
    t.outstanding += r.outstanding;
    t.unapplied += r.unapplied;
    t.netBalance += r.netBalance;
    t.overdue += r.overdue;
  }
  return t;
}
