// New invoice checks (Part 2, R3, R4, R9).
import { z } from 'zod';
import { GST_RATES } from '@/lib/ar/gst';
import { previewInvoice, type InvoicePreview } from '@/lib/ar/invoices';
import type { ArData, Paise } from '@/lib/ar/types';
import { isValidDate } from '@/lib/asof';
import { requiredText, rupeesToPaise, toFieldErrors, type FieldErrors, type FormResult } from './common';

export const INVOICE_FIELDS = ['customerId', 'invoiceDate', 'description', 'taxableValue', 'gstRatePct'] as const;

export interface InvoiceInput {
  customerId: number; invoiceDate: string; description: string; taxableValue: Paise; gstRatePct: number;
}

/** What the invoice form shows after a save attempt. */
export interface InvoiceFormState { values: Record<string, string>; errors: FieldErrors; message?: string; attempt: number }

export const taxableSchema = rupeesToPaise('Taxable value').refine((p) => p > 0, { error: 'Taxable value must be more than zero' });

const schema = z.object({
  customerId: z.string().regex(/^\d+$/, { error: 'Choose a customer' }).transform(Number),
  invoiceDate: z.string().refine(isValidDate, { error: 'Enter a valid invoice date' }),
  description: requiredText('Description'),
  taxableValue: taxableSchema,
  gstRatePct: z.string().transform(Number)
    .refine((n) => (GST_RATES as readonly number[]).includes(n), { error: `GST rate must be one of ${GST_RATES.join(', ')}%` }),
});

/** Checks a new invoice against the current data and works out its preview. */
export function checkInvoice(form: Record<string, unknown>, data: ArData): FormResult<InvoiceInput & { preview: InvoicePreview }> {
  const parsed = schema.safeParse(form);
  if (!parsed.success) return { ok: false, errors: toFieldErrors(parsed.error) };
  const input = parsed.data;

  const customer = data.customers.find((c) => c.id === input.customerId);
  if (!customer) return { ok: false, errors: { customerId: ['Choose a customer'] } };
  if (!customer.isActive) {
    return { ok: false, errors: { customerId: [`${customer.name} is inactive and cannot be given new invoices. Reactivate the customer first.`] } };
  }

  const preview = previewInvoice(data, input);
  if (preview.invoiceNo.length > 16) {
    return { ok: false, errors: { invoiceDate: [`Invoice number ${preview.invoiceNo} would be longer than 16 characters.`] } };
  }
  return { ok: true, data: { ...input, preview } };
}
