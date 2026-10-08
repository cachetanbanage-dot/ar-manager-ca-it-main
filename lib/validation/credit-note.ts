// New credit note checks (R7, R8).
import { z } from 'zod';
import { previewCreditNote, type CreditNotePreview } from '@/lib/ar/invoices';
import type { ArData, Paise } from '@/lib/ar/types';
import { isValidDate } from '@/lib/asof';
import { formatDate, formatMoney } from '@/lib/format';
import { requiredText, rupeesToPaise, toFieldErrors, type FieldErrors, type FormResult } from './common';

export const CREDIT_NOTE_FIELDS = ['creditNoteDate', 'taxableValue', 'reason'] as const;

export interface CreditNoteInput { creditNoteDate: string; taxableValue: Paise; reason: string }

/** What the credit note form shows after a save attempt. */
export interface CreditNoteFormState { values: Record<string, string>; errors: FieldErrors; message?: string; attempt: number }

export const cnTaxableSchema = rupeesToPaise('Taxable value').refine((p) => p > 0, { error: 'Taxable value must be more than zero' });

const schema = z.object({
  creditNoteDate: z.string().refine(isValidDate, { error: 'Enter a valid credit note date' }),
  taxableValue: cnTaxableSchema,
  reason: requiredText('Reason'),
});

/** Checks a credit note against its invoice and the current data, and works out its preview. */
export function checkCreditNote(
  form: Record<string, unknown>, data: ArData, invoiceId: number,
): FormResult<CreditNoteInput & { preview: CreditNotePreview }> {
  const invoice = data.invoices.find((i) => i.id === invoiceId);
  if (!invoice) return { ok: false, errors: { reason: ['This invoice does not exist.'] } };
  if (invoice.isCancelled) return { ok: false, errors: { reason: [`${invoice.invoiceNo} is cancelled; nothing can be credited against it.`] } };

  const parsed = schema.safeParse(form);
  if (!parsed.success) return { ok: false, errors: toFieldErrors(parsed.error) };
  const input = parsed.data;

  if (input.creditNoteDate < invoice.invoiceDate) {
    return { ok: false, errors: { creditNoteDate: [`A credit note cannot be dated before its invoice (${formatDate(invoice.invoiceDate)}).`] } };
  }
  const preview = previewCreditNote(data, invoiceId, input.creditNoteDate, input.taxableValue);
  if (preview.exceedsRemaining) {
    return { ok: false, errors: { taxableValue: [
      `The credit note total ${formatMoney(preview.total)} is more than the ${formatMoney(preview.remaining)} still open on ${invoice.invoiceNo}.`,
    ] } };
  }
  return { ok: true, data: { ...input, preview } };
}
