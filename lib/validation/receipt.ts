// Record a payment and allocate credit: input checks (R5, R6).
import { z } from 'zod';
import { allocationProblems, receiptRemaining, type AllocationLine } from '@/lib/ar/receipts';
import type { ArData, Paise, ReceiptMode } from '@/lib/ar/types';
import { isValidDate } from '@/lib/asof';
import { formatDate } from '@/lib/format';
import { requiredText, rupeesToPaise, toFieldErrors, type FieldErrors, type FormResult } from './common';

export const RECEIPT_MODES: ReceiptMode[] = ['NEFT', 'RTGS', 'IMPS', 'UPI', 'Cheque'];
export const RECEIPT_FIELDS = ['customerId', 'receiptDate', 'bankAmount', 'tdsAmount', 'mode', 'reference'] as const;

/** Allocation amounts are posted as fields named alloc_<invoiceId>. */
export const ALLOC_PREFIX = 'alloc_';

/** What a payment or allocation form shows after a save attempt. */
export interface PaymentFormState { values: Record<string, string>; errors: FieldErrors; message?: string; attempt: number }

export interface ReceiptInput {
  customerId: number; receiptDate: string; bankAmount: Paise; tdsAmount: Paise; mode: ReceiptMode; reference: string;
}

const optionalRupees = rupeesToPaise('Amount');

/** Reads the alloc_<invoiceId> fields; blanks count as zero. */
function readLines(form: Record<string, string>): { lines: AllocationLine[]; errors: FieldErrors } {
  const lines: AllocationLine[] = [];
  const errors: FieldErrors = {};
  for (const [key, value] of Object.entries(form)) {
    if (!key.startsWith(ALLOC_PREFIX) || value.trim() === '') continue;
    const parsed = optionalRupees.safeParse(value);
    if (!parsed.success) errors[key] = ['Enter an amount like 5000 or 5000.50'];
    else if (parsed.data > 0) lines.push({ invoiceId: Number(key.slice(ALLOC_PREFIX.length)), amount: parsed.data });
  }
  return { lines, errors };
}

const receiptSchema = z.object({
  customerId: z.string().regex(/^\d+$/, { error: 'Choose a customer' }).transform(Number),
  receiptDate: z.string().refine(isValidDate, { error: 'Enter a valid receipt date' }),
  bankAmount: rupeesToPaise('Bank amount'),
  tdsAmount: rupeesToPaise('TDS'),
  mode: z.enum(RECEIPT_MODES as [ReceiptMode, ...ReceiptMode[]], { error: 'Choose a payment mode' }),
  reference: requiredText('Reference', 100),
});

/** R5 + R6: a new receipt and its allocations, all dated the receipt date. */
export function checkReceipt(form: Record<string, string>, data: ArData): FormResult<{ receipt: ReceiptInput; lines: AllocationLine[] }> {
  const parsed = receiptSchema.safeParse(form);
  const { lines, errors: lineErrors } = readLines(form);
  if (!parsed.success || Object.keys(lineErrors).length > 0) {
    return { ok: false, errors: { ...(parsed.success ? {} : toFieldErrors(parsed.error)), ...lineErrors } };
  }
  const receipt = parsed.data;
  if (!data.customers.some((c) => c.id === receipt.customerId)) return { ok: false, errors: { customerId: ['Choose a customer'] } };
  const settlement = receipt.bankAmount + receipt.tdsAmount;
  if (settlement <= 0) return { ok: false, errors: { bankAmount: ['Enter the amount received (bank plus TDS must be more than zero)'] } };

  const problems = allocationProblems(data, receipt.customerId, receipt.receiptDate, receipt.receiptDate, settlement, lines);
  if (problems.length > 0) return { ok: false, errors: { allocations: problems } };
  return { ok: true, data: { receipt, lines } };
}

/** R6: allocating a receipt's unapplied credit later, with its own allocation date. */
export function checkAllocation(
  form: Record<string, string>, data: ArData, receiptId: number,
): FormResult<{ allocationDate: string; lines: AllocationLine[] }> {
  const receipt = data.receipts.find((r) => r.id === receiptId);
  if (!receipt) return { ok: false, errors: { receiptId: ['Choose a receipt'] } };
  if (!isValidDate(form.allocationDate ?? '')) return { ok: false, errors: { allocationDate: ['Enter a valid allocation date'] } };
  if (form.allocationDate < receipt.receiptDate) {
    return { ok: false, errors: { allocationDate: [`The allocation date cannot be before the receipt date (${formatDate(receipt.receiptDate)}).`] } };
  }
  const { lines, errors } = readLines(form);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  if (lines.length === 0) return { ok: false, errors: { allocations: ['Enter an amount against at least one invoice.'] } };

  const problems = allocationProblems(data, receipt.customerId, receipt.receiptDate, form.allocationDate, receiptRemaining(data, receiptId), lines);
  if (problems.length > 0) return { ok: false, errors: { allocations: problems } };
  return { ok: true, data: { allocationDate: form.allocationDate, lines } };
}
