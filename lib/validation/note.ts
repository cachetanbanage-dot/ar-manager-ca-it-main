// New note checks (R16): a date, type, optional invoice of the same customer,
// the text, an optional follow-up date, and an optional promise to pay
// (a date and an amount, both or neither).
import { z } from 'zod';
import type { ArData, NoteType, Paise } from '@/lib/ar/types';
import { isValidDate } from '@/lib/asof';
import { requiredText, rupeesToPaise, toFieldErrors, type FieldErrors, type FormResult } from './common';

export const NOTE_TYPES: NoteType[] = ['Call', 'Email', 'Meeting', 'Note'];
export const NOTE_FIELDS = ['customerId', 'invoiceId', 'noteDate', 'noteType', 'body', 'followUpDate', 'promiseDate', 'promiseAmount'] as const;

export interface NoteInput {
  customerId: number; invoiceId: number | null; noteDate: string; noteType: NoteType; body: string;
  followUpDate: string | null; promiseDate: string | null; promiseAmount: Paise | null;
}

/** What the note form shows after a save attempt. */
export interface NoteFormState { values: Record<string, string>; errors: FieldErrors; message?: string; attempt: number }

const optionalDate = (label: string) => z.string().trim()
  .refine((v) => v === '' || isValidDate(v), { error: `Enter a valid ${label}, or leave it blank` })
  .transform((v) => (v === '' ? null : v));

const schema = z.object({
  customerId: z.string().regex(/^\d+$/, { error: 'Choose a customer' }).transform(Number),
  invoiceId: z.string().regex(/^\d*$/).transform((v) => (v === '' ? null : Number(v))),
  noteDate: z.string().refine(isValidDate, { error: 'Enter a valid note date' }),
  noteType: z.enum(NOTE_TYPES as [NoteType, ...NoteType[]], { error: 'Choose a type' }),
  body: requiredText('The note', 2000),
  followUpDate: optionalDate('follow-up date'),
  promiseDate: optionalDate('promise date'),
  promiseAmount: z.string().trim(),
});

export function checkNote(form: Record<string, string>, data: ArData): FormResult<NoteInput> {
  const parsed = schema.safeParse(form);
  if (!parsed.success) return { ok: false, errors: toFieldErrors(parsed.error) };
  const n = parsed.data;
  const errors: FieldErrors = {};

  if (!data.customers.some((c) => c.id === n.customerId)) errors.customerId = ['Choose a customer'];
  if (n.invoiceId !== null) {
    const inv = data.invoices.find((i) => i.id === n.invoiceId);
    if (!inv || inv.customerId !== n.customerId) errors.invoiceId = ['Choose one of this customer’s invoices, or none'];
  }
  if (n.followUpDate !== null && n.followUpDate < n.noteDate) errors.followUpDate = ['The follow-up date cannot be before the note date'];

  // Promise to pay: both or neither
  let promiseAmount: Paise | null = null;
  if (n.promiseAmount !== '') {
    const amount = rupeesToPaise('Promised amount').safeParse(n.promiseAmount);
    if (!amount.success || amount.data <= 0) errors.promiseAmount = ['Enter the promised amount, more than zero'];
    else promiseAmount = amount.data;
  }
  if (n.promiseDate !== null && n.promiseAmount === '') errors.promiseAmount = ['A promise needs an amount as well as a date'];
  if (n.promiseDate === null && n.promiseAmount !== '') errors.promiseDate = ['A promise needs a date as well as an amount'];
  if (n.promiseDate !== null && n.promiseDate < n.noteDate) errors.promiseDate = ['The promise date cannot be before the note date'];

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, data: { ...n, promiseAmount } };
}
