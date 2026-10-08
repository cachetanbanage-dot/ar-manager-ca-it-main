'use server';
// Invoice changes (section 4.8). Once created, an invoice can change only its
// description and disputed flag (R3), or be cancelled (R8).
import { revalidatePath } from 'next/cache';
import { loadArData } from '@/lib/ar/load';
import { cancelBlocker } from '@/lib/ar/invoices';
import { db } from '@/lib/db';
import { friendlyDbError } from '@/lib/db-errors';
import type { ActionState } from '@/lib/validation/common';

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
