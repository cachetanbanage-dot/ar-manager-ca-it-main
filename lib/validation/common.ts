// Shared input checks for every form (zod). Amounts arrive as text in rupees
// and leave as whole paise.
import { z } from 'zod';

/** Field name → error messages, shown next to each field. */
export type FieldErrors = Record<string, string[] | undefined>;

export type FormResult<T> = { ok: true; data: T } | { ok: false; errors: FieldErrors };

/** The result of a simple action (a button or a one-field form), shown under it. */
export interface ActionState { error?: string; success?: string; attempt: number }

/** Turns a zod failure into field errors. */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  return z.flattenError(error).fieldErrors as FieldErrors;
}

/** Text that must be filled in. */
export const requiredText = (label: string, max = 200) =>
  z.string({ error: `${label} is required` }).trim()
    .min(1, { error: `${label} is required` })
    .max(max, { error: `${label} must be at most ${max} characters` });

/** Text that may be left blank (saved as null). */
export const optionalText = (max = 200) =>
  z.string().trim().max(max, { error: `Must be at most ${max} characters` })
    .optional().transform((v) => (v ? v : null));

/** A rupee amount typed as text, e.g. "5,00,000" or "88500.50", converted to whole paise. */
export const rupeesToPaise = (label: string) =>
  z.string({ error: `${label} is required` }).trim()
    .transform((v) => v.replace(/,/g, ''))
    .refine((v) => v !== '', { error: `${label} is required` })
    .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), { error: `${label} must be an amount like 50000 or 50000.50, not negative` })
    .transform((v) => Math.round(Number(v) * 100));
