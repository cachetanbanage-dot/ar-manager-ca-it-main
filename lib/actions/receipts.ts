'use server';
// Receipts and allocations (section 4.8, R5, R6).
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { loadArData } from '@/lib/ar/load';
import { nextNumber } from '@/lib/ar/numbering';
import { asofParam, hrefWithAsOf } from '@/lib/asof';
import { db } from '@/lib/db';
import { friendlyDbError } from '@/lib/db-errors';
import type { ActionState } from '@/lib/validation/common';
import { ALLOC_PREFIX, RECEIPT_FIELDS, checkAllocation, checkReceipt, type PaymentFormState } from '@/lib/validation/receipt';

const isDuplicate = (message: string) => /duplicate key|unique/i.test(message);

/** Every field of the form as text, including the alloc_<invoiceId> amounts. */
function formValues(formData: FormData, fields: readonly string[]): Record<string, string> {
  const values: Record<string, string> = Object.fromEntries(fields.map((f) => [f, String(formData.get(f) ?? '')]));
  for (const [k, v] of formData.entries()) if (k.startsWith(ALLOC_PREFIX)) values[k] = String(v);
  return values;
}

/**
 * Record a payment with its allocations. The API has no transactions, so the
 * receipt is saved first and, if its allocations cannot be saved, deleted again.
 */
export async function recordPayment(prev: PaymentFormState, formData: FormData): Promise<PaymentFormState> {
  const values = formValues(formData, RECEIPT_FIELDS);
  const failed = (errors: PaymentFormState['errors'], message: string) => ({ values, errors, message, attempt: prev.attempt + 1 });

  let receiptId: number | null = null;
  let lines: { invoiceId: number; amount: number }[] = [];
  let receiptDate = '';
  for (let attempt = 1; attempt <= 2 && receiptId === null; attempt++) {
    const data = await loadArData();
    const checked = checkReceipt(values, data);
    if (!checked.ok) return failed(checked.errors, 'Please correct the problems shown in red.');
    const r = checked.data.receipt;
    lines = checked.data.lines;
    receiptDate = r.receiptDate;

    const { data: row, error } = await db.from('receipts').insert({
      receipt_no: nextNumber('receipt', data, r.receiptDate), customer_id: r.customerId, receipt_date: r.receiptDate,
      bank_amount: r.bankAmount / 100, tds_amount: r.tdsAmount / 100, mode: r.mode, reference: r.reference,
    }).select('id').single();
    if (error && !(isDuplicate(error.message) && attempt === 1)) return failed({}, friendlyDbError(error.message));
    if (row) receiptId = row.id;
  }

  if (lines.length > 0) {
    const { error } = await db.from('allocations').insert(lines.map((l) => ({
      receipt_id: receiptId, invoice_id: l.invoiceId, allocation_date: receiptDate, amount: l.amount / 100,
    })));
    if (error) {
      await db.from('receipts').delete().eq('id', receiptId!);
      return failed({}, `Nothing was saved: the allocations were refused (${friendlyDbError(error.message)}).`);
    }
  }

  revalidatePath('/', 'layout');
  redirect(hrefWithAsOf(`/customers/${values.customerId}`, asofParam(String(formData.get('asof') ?? ''))));
}

/** R6: allocate a receipt's unapplied credit, with an allocation date. */
export async function allocateCredit(prev: PaymentFormState, formData: FormData): Promise<PaymentFormState> {
  const values = formValues(formData, ['receiptId', 'allocationDate']);
  const receiptId = Number(values.receiptId);
  const failed = (errors: PaymentFormState['errors'], message: string) => ({ values, errors, message, attempt: prev.attempt + 1 });
  const data = await loadArData();
  const checked = checkAllocation(values, data, receiptId);
  if (!checked.ok) return failed(checked.errors, 'Please correct the problems shown in red.');

  const { error } = await db.from('allocations').insert(checked.data.lines.map((l) => ({
    receipt_id: receiptId, invoice_id: l.invoiceId, allocation_date: checked.data.allocationDate, amount: l.amount / 100,
  })));
  if (error) return failed({}, friendlyDbError(error.message));

  const customerId = data.receipts.find((r) => r.id === receiptId)!.customerId;
  revalidatePath('/', 'layout');
  redirect(hrefWithAsOf(`/customers/${customerId}`, asofParam(String(formData.get('asof') ?? ''))));
}

/** Correction: remove one allocation; the amount becomes unapplied credit again. */
export async function removeAllocation(allocationId: number, prev: ActionState): Promise<ActionState> {
  const { error } = await db.from('allocations').delete().eq('id', allocationId);
  if (error) return { error: friendlyDbError(error.message), attempt: prev.attempt + 1 };
  revalidatePath('/', 'layout');
  return { success: 'Allocation removed. The amount is unapplied credit again.', attempt: prev.attempt + 1 };
}

/** Correction: delete a receipt that has no allocations. */
export async function deleteReceipt(receiptId: number, prev: ActionState): Promise<ActionState> {
  const data = await loadArData();
  const receipt = data.receipts.find((r) => r.id === receiptId);
  if (!receipt) return { error: 'This receipt no longer exists.', attempt: prev.attempt + 1 };
  if (data.allocations.some((a) => a.receiptId === receiptId)) {
    return { error: `${receipt.receiptNo} still has allocations. Remove them first.`, attempt: prev.attempt + 1 };
  }
  const { error } = await db.from('receipts').delete().eq('id', receiptId);
  if (error) return { error: friendlyDbError(error.message), attempt: prev.attempt + 1 };
  revalidatePath('/', 'layout');
  return { success: `${receipt.receiptNo} deleted.`, attempt: prev.attempt + 1 };
}
