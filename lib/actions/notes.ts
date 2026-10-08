'use server';
// Notes, follow-ups and promises to pay (R16). Notes are a record of what was
// said, so they are added but not edited or deleted; only the follow-up can be marked done.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { loadArData } from '@/lib/ar/load';
import { asofParam, hrefWithAsOf } from '@/lib/asof';
import { db } from '@/lib/db';
import { friendlyDbError } from '@/lib/db-errors';
import type { ActionState } from '@/lib/validation/common';
import { NOTE_FIELDS, checkNote, type NoteFormState } from '@/lib/validation/note';

export async function createNote(prev: NoteFormState, formData: FormData): Promise<NoteFormState> {
  const values = Object.fromEntries(NOTE_FIELDS.map((f) => [f, String(formData.get(f) ?? '')]));
  const failed = (errors: NoteFormState['errors'], message: string) => ({ values, errors, message, attempt: prev.attempt + 1 });

  const checked = checkNote(values, await loadArData());
  if (!checked.ok) return failed(checked.errors, 'Please correct the fields marked in red.');
  const n = checked.data;

  const { error } = await db.from('notes').insert({
    customer_id: n.customerId, invoice_id: n.invoiceId, note_date: n.noteDate, note_type: n.noteType, body: n.body,
    follow_up_date: n.followUpDate, follow_up_done: false,
    promise_date: n.promiseDate, promise_amount: n.promiseAmount === null ? null : n.promiseAmount / 100,
  });
  if (error) return failed({}, friendlyDbError(error.message));

  revalidatePath('/', 'layout');
  const back = formData.get('back') === 'invoice' && n.invoiceId !== null ? `/invoices/${n.invoiceId}` : `/customers/${n.customerId}`;
  redirect(hrefWithAsOf(back, asofParam(String(formData.get('asof') ?? ''))));
}

/** R16: a follow-up marked done no longer shows as due. */
export async function markFollowUpDone(noteId: number, prev: ActionState): Promise<ActionState> {
  const { error } = await db.from('notes').update({ follow_up_done: true }).eq('id', noteId);
  if (error) return { error: friendlyDbError(error.message), attempt: prev.attempt + 1 };
  revalidatePath('/', 'layout');
  return { success: 'Follow-up marked as done.', attempt: prev.attempt + 1 };
}
