// Everything the home screen shows (Part 2), as at a date. Figures come from lib/ar.
import { ageingTotals, dashboardSummary, type AgeingTotals, type DashboardSummary } from '@/lib/ar/dashboard';
import { followUpsDue, promiseStatuses, type FollowUp, type PromiseToPay } from '@/lib/ar/notes';
import { customerPositions, invoicePositions, type CustomerPosition, type InvoicePosition } from '@/lib/ar/positions';
import type { ArData, Customer } from '@/lib/ar/types';
import { sortRows } from '@/lib/sort';

export interface Dashboard {
  summary: DashboardSummary;
  ageing: CustomerPosition[]; // customers with something outstanding or unapplied, by code
  ageingTotals: AgeingTotals;
  overdueInvoices: (InvoicePosition & { customer: Customer })[]; // longest late first
  overLimit: CustomerPosition[];
  brokenPromises: PromiseToPay[];
  followUps: FollowUp[];
  unappliedCredit: CustomerPosition[];
}

export function dashboard(data: ArData, asOf: string): Dashboard {
  const positions = sortRows(customerPositions(data, asOf), (p) => p.customer.code, 'asc');
  const ageing = positions.filter((p) => p.outstanding !== 0 || p.unapplied !== 0);
  const customers = new Map(data.customers.map((c) => [c.id, c]));
  const overdue = invoicePositions(data, asOf)
    .filter((p) => p.status === 'Overdue')
    .map((p) => ({ ...p, customer: customers.get(p.invoice.customerId)! }));

  return {
    summary: dashboardSummary(data, asOf),
    ageing,
    ageingTotals: ageingTotals(ageing),
    overdueInvoices: sortRows(sortRows(overdue, (p) => p.invoice.invoiceNo, 'asc'), (p) => p.daysPastDue, 'desc'),
    overLimit: positions.filter((p) => p.overLimit),
    brokenPromises: promiseStatuses(data, asOf).filter((p) => p.status === 'Broken'),
    followUps: followUpsDue(data, asOf),
    unappliedCredit: positions.filter((p) => p.unapplied > 0),
  };
}
