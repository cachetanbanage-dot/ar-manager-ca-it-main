// Customer form checks (Part 2): required fields, a unique code, a valid email,
// credit days ≥ 0, a credit limit ≥ 0, a TDS rate from 0 to 100, and an
// optional 15-character GSTIN.
import { z } from 'zod';
import type { Customer, Paise } from '@/lib/ar/types';
import { INDIAN_STATES } from '@/lib/states';
import { optionalText, requiredText, rupeesToPaise, toFieldErrors, type FieldErrors, type FormResult } from './common';

export const CUSTOMER_FIELDS = [
  'code', 'name', 'city', 'state', 'contactPerson', 'email', 'phone', 'gstin', 'creditDays', 'creditLimit', 'tdsRatePct',
] as const;

/** What the customer form shows after a save attempt. */
export interface CustomerFormState {
  values: Record<string, string>; // what was typed, so it is not lost on an error
  errors: FieldErrors;
  message?: string;
  attempt: number;
}

export interface CustomerInput {
  code: string; name: string; city: string; state: string; contactPerson: string; email: string;
  phone: string | null; gstin: string | null; creditDays: number; creditLimit: Paise; tdsRatePct: number;
}

const schema = z.object({
  code: requiredText('Code', 20).transform((v) => v.toUpperCase())
    .refine((v) => /^[A-Z0-9-]+$/.test(v), { error: 'Code may use only letters, digits and hyphens' }),
  name: requiredText('Name'),
  city: requiredText('City', 100),
  state: z.enum(INDIAN_STATES, { error: 'Choose a state from the list' }),
  contactPerson: requiredText('Contact person', 100),
  email: z.string().trim().min(1, { error: 'Email is required' })
    .pipe(z.email({ error: 'Enter a valid email address, like accounts@company.com' })),
  phone: optionalText(30),
  gstin: optionalText(15).transform((v) => (v ? v.toUpperCase() : null))
    .refine((v) => v === null || /^[0-9A-Z]{15}$/.test(v), { error: 'GSTIN must be exactly 15 letters and digits' }),
  creditDays: z.string().trim().min(1, { error: 'Credit days is required' })
    .refine((v) => /^\d+$/.test(v), { error: 'Credit days must be a whole number, 0 or more' })
    .transform(Number),
  creditLimit: rupeesToPaise('Credit limit'),
  tdsRatePct: z.string().trim().min(1, { error: 'TDS rate is required' })
    .refine((v) => /^\d+(\.\d{1,2})?$/.test(v) && Number(v) <= 100, { error: 'TDS rate must be from 0 to 100' })
    .transform(Number),
});

/**
 * Checks a submitted customer form. `existing` is every customer already saved;
 * `editingId` is the customer being edited (so its own code is not a clash).
 */
export function checkCustomer(
  form: Record<string, unknown>, existing: Customer[], editingId?: number,
): FormResult<CustomerInput> {
  const parsed = schema.safeParse(form);
  if (!parsed.success) return { ok: false, errors: toFieldErrors(parsed.error) };

  const clash = existing.find((c) => c.code.toUpperCase() === parsed.data.code && c.id !== editingId);
  if (clash) return { ok: false, errors: { code: [`Code ${parsed.data.code} is already used by ${clash.name}`] } };

  return { ok: true, data: parsed.data };
}
