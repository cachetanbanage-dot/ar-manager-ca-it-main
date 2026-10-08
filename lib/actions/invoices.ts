'use server';
// Invoice changes (section 4.8). Once created, an invoice can change only its
// description and disputed flag (R3), or be cancelled (R8).
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { loadArData } from '@/lib/ar/load';
import { cancelBlocker } from '@/lib/ar/invoices';
import { asofParam, hrefWithAsOf } from '@/lib/asof';
import { db } from '@/lib/db';
import { friendlyDbError } from '@/lib/db-errors';
import type { ActionState } from '@/lib/validation/common';
import { INVOICE_FIELDS, checkInvoice, type InvoiceFormState } from '@/lib/validation/invoice';

const isDuplicate = (message: string) => /duplicate key|unique/i.test(message);

/**
 * Create an invoice (section 4.8). The server works out the number, due date,
 * GST and total again from fresh data — it never trusts the browser's preview.
 * If another tab took the same number a moment earlier, it retries once.
 */
export async function createInvoice(prev: InvoiceFormState, formData: FormData): Promise<InvoiceFormState> {
  const values = Object.fromEntries(INVOICE_FIELDS.map((f) => [f, String(formData.get(f) ?? '')]));
  const failed = (errors: InvoiceFormState['errors'], message: string) => ({ values, errors, message, attempt: prev.attempt + 1 });

  let createdId: number | null = null;
  for (let attempt = 1; attempt <= 2 && createdId === null; attempt++) {
    const checked = checkInvoice(values, await loadArData());
    if (!checked.ok) return failed(checked.errors, 'Please correct the fields marked in red.');
    const { preview: p, ...input } = checked.data;

    const { data, error } = await db.from('invoices').insert({
      invoice_no: p.invoiceNo, customer_id: input.customerId, invoice_date: input.invoiceDate, due_date: p.dueDate,
      description: input.description, taxable_value: input.taxableValue / 100, gst_rate_pct: input.gstRatePct,
      cgst: p.cgst / 100, sgst: p.sgst / 100, igst: p.igst / 100, total: p.total / 100,
      is_cancelled: false, is_disputed: false,
    }).select('id').single();

    if (error && !(isDuplicate(error.message) && attempt === 1)) return failed({}, friendlyDbError(error.message));
    if (data) createdId = data.id;
  }

  revalidatePath('/', 'layout');
  redirect(hrefWithAsOf(`/invoices/${createdId}`, asofParam(String(formData.get('asof') ?? ''))));
}

const done = (prev: ActionState, success: string): ActionState => ({ success, attempt: prev.attempt + 1 });
const fail = (prev: ActionState, error: string): ActionState => ({ error, attempt: prev.attempt + 1 });

async function update(invoiceId: number, fields: Record<string, unknown>): Promise<string | null> {
  const { error } = await db.from('invoices').update(fields).eq('id', invoiceId);
  if (error) return friendlyDbError(error.message);
  revalidatePath('/', 'layout');
  return null;
}

export async function updateInvoiceDescription(invoiceId: number, prev: ActionState, formData: FormData): Promise<ActionState> {
  const description = String(formData.get('description') ?? '').trim();
  if (description === '') return fail(prev, 'The description cannot be blank.');
  if (description.length > 200) return fail(prev, 'The description must be at most 200 characters.');
  const error = await update(invoiceId, { description });
  return error ? fail(prev, error) : done(prev, 'Description saved.');
}

export async function setInvoiceDisputed(invoiceId: number, disputed: boolean, prev: ActionState): Promise<ActionState> {
  const error = await update(invoiceId, { is_disputed: disputed });
  return error ? fail(prev, error) : done(prev, disputed ? 'Marked as disputed.' : 'Dispute cleared.');
}

/** R8: cancel, only if nothing has ever been allocated or credited against the invoice. */
export async function cancelInvoice(invoiceId: number, prev: ActionState, formData: FormData): Promise<ActionState> {
  if (formData.get('confirm') !== 'yes') return fail(prev, 'Tick the box to confirm the cancellation.');
  const blocker = cancelBlocker(await loadArData(), invoiceId);
  if (blocker) return fail(prev, blocker);
  const error = await update(invoiceId, { is_cancelled: true });
  return error ? fail(prev, error) : done(prev, 'Invoice cancelled. Its number stays used.');
}
