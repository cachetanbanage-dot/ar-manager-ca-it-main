// R5 and R6: receipts, TDS and allocations. The limits look at every record,
// whatever its date, because that is what the database enforces.
import { DEFAULT_GST_RATE_PCT } from './gst';
import { invoiceRemaining } from './invoices';
import type { ArData, Invoice, Paise } from './types';
import { formatMoney } from '@/lib/format';

/**
 * R5: the expected TDS for a bank amount, only to pre-fill the form.
 * TDS is deducted on the taxable value, and bank = taxable × (1 + GST − TDS rate),
 * so TDS = bank × rate ÷ (100 + GST − rate). E.g. 81,000 at 10% → 7,500.
 */
export function tdsPrefill(bankAmount: Paise, tdsRatePct: number, gstRatePct: number = DEFAULT_GST_RATE_PCT): Paise {
  if (bankAmount <= 0 || tdsRatePct <= 0) return 0;
  return Math.round((bankAmount * tdsRatePct) / (100 + gstRatePct - tdsRatePct));
}

/** R5 + R6: settlement value (bank + TDS) less every allocation from the receipt. */
export function receiptRemaining(data: ArData, receiptId: number): Paise {
  const r = data.receipts.find((x) => x.id === receiptId);
  if (!r) return 0;
  let remaining = r.bankAmount + r.tdsAmount;
  for (const a of data.allocations) if (a.receiptId === receiptId) remaining -= a.amount;
  return remaining;
}

export interface OpenInvoice { invoice: Invoice; remaining: Paise }

/**
 * R6: a customer's invoices that can take an allocation dated `allocationDate`:
 * not cancelled, dated on or before it, with something still open.
 * Oldest first: by due date, then invoice number.
 */
export function openInvoices(data: ArData, customerId: number, allocationDate: string): OpenInvoice[] {
  return data.invoices
    .filter((i) => i.customerId === customerId && !i.isCancelled && i.invoiceDate <= allocationDate)
    .map((invoice) => ({ invoice, remaining: invoiceRemaining(data, invoice.id) }))
    .filter((o) => o.remaining > 0)
    .sort((a, b) =>
      a.invoice.dueDate < b.invoice.dueDate ? -1 : a.invoice.dueDate > b.invoice.dueDate ? 1
        : a.invoice.invoiceNo < b.invoice.invoiceNo ? -1 : a.invoice.invoiceNo > b.invoice.invoiceNo ? 1 : 0);
}

/** R6: the oldest-first suggestion — fill each open invoice in turn until the amount runs out. */
export function suggestAllocations(open: OpenInvoice[], amount: Paise): Map<number, Paise> {
  const suggestion = new Map<number, Paise>();
  let left = Math.max(amount, 0);
  for (const o of open) {
    if (left <= 0) break;
    const take = Math.min(o.remaining, left);
    suggestion.set(o.invoice.id, take);
    left -= take;
  }
  return suggestion;
}

export interface AllocationLine { invoiceId: number; amount: Paise }

/**
 * R6: checks proposed allocations from one receipt (`available` is what the
 * receipt can still give). Returns a list of problems in plain language;
 * an empty list means they can be saved.
 */
export function allocationProblems(
  data: ArData, customerId: number, receiptDate: string, allocationDate: string, available: Paise, lines: AllocationLine[],
): string[] {
  const problems: string[] = [];
  if (allocationDate < receiptDate) problems.push('The allocation date cannot be earlier than the receipt date.');
  let total = 0;
  const seen = new Set<number>();
  for (const line of lines) {
    const inv = data.invoices.find((i) => i.id === line.invoiceId);
    if (!inv) { problems.push('An invoice in the list no longer exists.'); continue; }
    if (seen.has(inv.id)) problems.push(`${inv.invoiceNo} appears twice.`);
    seen.add(inv.id);
    if (line.amount <= 0) continue;
    total += line.amount;
    if (inv.customerId !== customerId) problems.push(`${inv.invoiceNo} belongs to another customer.`);
    if (inv.isCancelled) problems.push(`${inv.invoiceNo} is cancelled; nothing can be allocated to it.`);
    if (inv.invoiceDate > allocationDate) problems.push(`${inv.invoiceNo} is dated after the allocation date.`);
    const remaining = invoiceRemaining(data, inv.id);
    if (line.amount > remaining) {
      problems.push(`${inv.invoiceNo} has only ${formatMoney(remaining)} open; ${formatMoney(line.amount)} was entered.`);
    }
  }
  if (total > available) {
    problems.push(`The allocations add up to ${formatMoney(total)}, more than the ${formatMoney(available)} available from the receipt.`);
  }
  return problems;
}

/** The running totals under an allocation table: how much is allocated and what stays unapplied. */
export function allocationSummary(available: Paise, amounts: Paise[]): { allocated: Paise; unapplied: Paise } {
  const allocated = amounts.reduce((sum, a) => sum + Math.max(a, 0), 0);
  return { allocated, unapplied: available - allocated };
}
