// Reads the statement's customer and period from the URL (R15).
import { fyStart } from '@/lib/ar/dates';
import type { ArData, Customer } from '@/lib/ar/types';
import { isValidDate } from '@/lib/asof';

export interface StatementOptions { customer: Customer | null; from: string; to: string; error: string | null }

/** Defaults: from 1 April of the as-at date's financial year, to the as-at date. */
export function statementOptions(params: Record<string, string | string[] | undefined>, data: ArData, asOf: string): StatementOptions {
  const one = (k: string) => (Array.isArray(params[k]) ? params[k][0] : params[k]) ?? '';
  const customer = data.customers.find((c) => String(c.id) === one('customer')) ?? null;
  const from = isValidDate(one('from')) ? one('from') : fyStart(asOf);
  const to = isValidDate(one('to')) ? one('to') : asOf;
  return { customer, from, to, error: from > to ? 'The "from" date must be on or before the "to" date.' : null };
}
